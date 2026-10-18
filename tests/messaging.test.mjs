import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('messaging module and services', async (t) => {
  const vite = await createServer({
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });

  try {
    const { getInitials, formatMessageTime } = await vite.ssrLoadModule('/src/models/message.ts');
    const { messageService } = await vite.ssrLoadModule('/src/services/messageService.ts');

    await t.test('initials formatter generates 2-letter uppercase codes', () => {
      assert.equal(getInitials('Lolo Ben'), 'LB');
      assert.equal(getInitials('Maria Santos'), 'MS');
      assert.equal(getInitials('OSCA'), 'OS');
      assert.equal(getInitials(''), '??');
    });

    await t.test('message time formatter handles valid ISO dates and nulls gracefully', () => {
      assert.equal(formatMessageTime(undefined), '');
      assert.equal(formatMessageTime(''), '');
      const formatted = formatMessageTime(new Date().toISOString());
      assert.ok(formatted.length > 0);
    });

    await t.test('contacts list loads with initials and latest message preview', async () => {
      const contacts = await messageService.getContacts();
      assert.ok(Array.isArray(contacts));
      assert.ok(contacts.length > 0);

      const loloBen = contacts.find((c) => c.name === 'Lolo Ben');
      assert.ok(loloBen);
      assert.equal(loloBen.id, 2);
      assert.ok(loloBen.lastMessage);
    });



    await t.test('message thread loads ordered messages between participants', async () => {
      const msgs = await messageService.getMessages(2);
      assert.ok(Array.isArray(msgs));
      assert.ok(msgs.length > 0);

      // Verify each message is between user 1 and user 2
      for (const msg of msgs) {
        assert.ok(
          (msg.sender_id === 1 && msg.receiver_id === 2) ||
            (msg.sender_id === 2 && msg.receiver_id === 1),
        );
      }
    });

    await t.test('sending a message validates content and appends to thread', async () => {
      await assert.rejects(
        async () => {
          await messageService.sendMessage(2, '   ');
        },
        /Message cannot be empty/i,
      );

      const sent = await messageService.sendMessage(2, 'Kumusta ka Lolo Ben?');
      assert.equal(sent.message, 'Kumusta ka Lolo Ben?');
      assert.equal(sent.receiver_id, 2);

      const updated = await messageService.getMessages(2);
      assert.ok(updated.some((m) => m.message === 'Kumusta ka Lolo Ben?'));
    });

    await t.test('subscription receives newly posted messages', async () => {
      let receivedMsg = null;
      const unsubscribe = messageService.subscribeToMessages(4, (msg) => {
        receivedMsg = msg;
      });

      await messageService.sendMessage(4, 'Hello Lola Carmen!');
      assert.ok(receivedMsg);
      assert.equal(receivedMsg.message, 'Hello Lola Carmen!');
      assert.equal(receivedMsg.receiver_id, 4);

      unsubscribe();
    });
  } finally {
    await vite.close();
  }
});
