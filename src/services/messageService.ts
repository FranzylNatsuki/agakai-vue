import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';
import { profileService } from '@/services/profileService';
import type { Message, ChatContact } from '@/models/message';
import { getInitials } from '@/models/message';
import { mockContacts, mockMessages } from '@/data/mock';

type MessageListener = (msg: Message) => void;
const mockListeners = new Set<MessageListener>();

export const messageService = {
  /**
   * Retrieves the current senior's numeric user ID.
   */
  async getCurrentProfileId(): Promise<number> {
    const profile = await profileService.loadProfileOrNull();
    return profile?.id ?? 1;
  },

  /**
   * Returns mock contacts with their latest message preview and timestamp.
   */
  getMockContacts(myId: number): ChatContact[] {
    return mockContacts.map((c) => {
      const msgs = mockMessages.filter(
        (m) =>
          (m.sender_id === myId && m.receiver_id === c.id) ||
          (m.sender_id === c.id && m.receiver_id === myId),
      );
      const latest = msgs[msgs.length - 1];
      return {
        ...c,
        lastMessage: latest?.message ?? c.subtitle,
        lastMessageTime: latest?.created_at,
      };
    });
  },

  /**
   * Retrieves the list of contacts available to chat with,
   * annotated with their latest message preview and timestamp.
   */
  async getContacts(): Promise<ChatContact[]> {
    const myId = await this.getCurrentProfileId();
    const authUserId = await profileService.currentUserId();

    if (isBackendConfigured() && authUserId) {
      try {
        const supabase = getSupabase();
        // 1. Fetch contacts via RPC or user directory
        let contacts: ChatContact[] = [];
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_chat_contacts');

        if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
          contacts = rpcData.map((u: any) => ({
            id: Number(u.id),
            name: String(u.name || 'Senior Citizen'),
            city: u.city ?? undefined,
            address: u.address ?? undefined,
            gender: u.gender ?? undefined,
            subtitle: u.address || u.city || 'Fellow Senior',
            initials: getInitials(u.name || 'Senior'),
          }));
        } else {
          // Fallback query if RPC isn't deployed yet
          const { data: usersData } = await supabase
            .from('user')
            .select('id, name, city, address, gender')
            .neq('id', myId)
            .limit(20);

          if (usersData && usersData.length > 0) {
            contacts = usersData.map((u: any) => ({
              id: Number(u.id),
              name: String(u.name || 'Senior Citizen'),
              city: u.city ?? undefined,
              address: u.address ?? undefined,
              gender: u.gender ?? undefined,
              subtitle: u.address || u.city || 'Fellow Senior',
              initials: getInitials(u.name || 'Senior'),
            }));
          }
        }

        // 2. Attach latest message for each contact from Supabase
        for (const contact of contacts) {
          const { data: latest } = await supabase
            .from('messages')
            .select('message, created_at')
            .or(
              `and(sender_id.eq.${myId},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${myId})`,
            )
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latest) {
            contact.lastMessage = latest.message;
            contact.lastMessageTime = latest.created_at;
          }
        }

        if (contacts.length > 0) {
          return contacts;
        }
      } catch {
        // Fall back to mock data
      }
    }

    // Mock data mode fallback
    return this.getMockContacts(myId);
  },

  /**
   * Loads all messages in chronological order between current user and a contact.
   */
  async getMessages(contactId: number): Promise<Message[]> {
    const myId = await this.getCurrentProfileId();
    const authUserId = await profileService.currentUserId();

    if (isBackendConfigured() && authUserId) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('messages')
          .select('id, sender_id, receiver_id, message, created_at')
          .or(
            `and(sender_id.eq.${myId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${myId})`,
          )
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: Number(d.id),
            sender_id: Number(d.sender_id),
            receiver_id: Number(d.receiver_id),
            message: String(d.message),
            created_at: String(d.created_at),
          }));
        }
      } catch {
        // Fall back to mock
      }
    }

    return mockMessages
      .filter(
        (m) =>
          (m.sender_id === myId && m.receiver_id === contactId) ||
          (m.sender_id === contactId && m.receiver_id === myId),
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  /**
   * Sends a message to a contact.
   */
  async sendMessage(receiverId: number, messageText: string): Promise<Message> {
    const text = messageText.trim();
    if (!text) {
      throw new Error('Message cannot be empty.');
    }

    const myId = await this.getCurrentProfileId();
    const authUserId = await profileService.currentUserId();

    if (isBackendConfigured() && authUserId) {
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase
          .from('messages')
          .insert({
            sender_id: myId,
            receiver_id: receiverId,
            message: text,
          })
          .select()
          .single();

        if (!error && data) {
          return {
            id: Number(data.id),
            sender_id: Number(data.sender_id),
            receiver_id: Number(data.receiver_id),
            message: String(data.message),
            created_at: String(data.created_at),
          };
        }
      } catch {
        // Fall back to mock mode if backend write fails
      }
    }

    // Mock mode
    const newMsg: Message = {
      id: Date.now(),
      sender_id: myId,
      receiver_id: receiverId,
      message: text,
      created_at: new Date().toISOString(),
    };
    mockMessages.push(newMsg);

    // Notify active listeners
    for (const listener of mockListeners) {
      listener(newMsg);
    }

    // Simulate an auto-reply in mock mode after 1.5 seconds if talking to Lolo Ben or OSCA
    setTimeout(() => {
      let replyText = '';
      if (receiverId === 2) {
        replyText = 'Salamat sa mensahe Lola! Mag-amping kanunay.';
      } else if (receiverId === 3) {
        replyText = 'Nadawat namo ang imong mensahe. Motubag ang OSCA staff sa labing dali nga panahon.';
      } else {
        replyText = 'Daghang salamat!';
      }

      const replyMsg: Message = {
        id: Date.now() + 1,
        sender_id: receiverId,
        receiver_id: myId,
        message: replyText,
        created_at: new Date().toISOString(),
      };
      mockMessages.push(replyMsg);
      for (const listener of mockListeners) {
        listener(replyMsg);
      }
    }, 1500);

    return newMsg;
  },

  /**
   * Subscribes to real-time message events between the current senior and contactId.
   */
  subscribeToMessages(contactId: number, onMessage: MessageListener): () => void {
    let supabaseUnsubscribe: (() => void) | null = null;

    void (async () => {
      const authUserId = await profileService.currentUserId();
      if (isBackendConfigured() && authUserId) {
        try {
          const supabase = getSupabase();
          const myId = await this.getCurrentProfileId();

          const channel = supabase
            .channel(`messages_thread_${contactId}_${Date.now()}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
              },
              (payload) => {
                const row = payload.new as Record<string, any>;
                if (!row) return;
                const sId = Number(row.sender_id);
                const rId = Number(row.receiver_id);
                if (
                  (sId === contactId && rId === myId) ||
                  (sId === myId && rId === contactId)
                ) {
                  onMessage({
                    id: Number(row.id),
                    sender_id: sId,
                    receiver_id: rId,
                    message: String(row.message),
                    created_at: String(row.created_at),
                  });
                }
              },
            )
            .subscribe();

          supabaseUnsubscribe = () => {
            void supabase.removeChannel(channel);
          };
        } catch {
          // Fall back to mock listeners
        }
      }
    })();

    mockListeners.add(onMessage);
    return () => {
      supabaseUnsubscribe?.();
      mockListeners.delete(onMessage);
    };
  },
};
