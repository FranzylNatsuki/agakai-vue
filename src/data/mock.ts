import type { Benefit } from '@/models/benefit';
import type { Profile } from '@/models/profile';

/**
 * Sample data used ONLY when VITE_USE_MOCK_DATA=true, so the UI can be
 * previewed before Supabase is connected. Delete once the backend is live.
 */
export const mockProfile: Profile = {
  id: 1,
  name: 'Maria Santos',
  seniorId: 'SC-2024-0001',
  mobileNo: '0917 123 4567',
  age: 68,
  birthday: 'Mar 14, 1958',
  address: 'Barangay Gun-ob, Lapu-Lapu City',
  gender: 'Female',
};

export const mockBenefits: Benefit[] = [
  {
    id: '1',
    title: 'Social Pension',
    dateAndLocation: 'Jan 15, 2026 • National / All LGUs',
    iconKey: 'pension',
    category: 'cash',
    description: 'Monthly stipend of ₱1,000 for indigent senior citizens.',
    lgu: 'National / All LGUs',
  },
  {
    id: '2',
    title: 'Free Medical Check-up',
    dateAndLocation: 'Feb 02, 2026 • Lapu-Lapu City',
    iconKey: 'medical',
    category: 'health',
    description: 'Free check-up and basic lab tests at the city health center.',
    lgu: 'Lapu-Lapu City',
  },
  {
    id: '3',
    title: 'Senior Discount',
    dateAndLocation: 'Always • National / All LGUs',
    iconKey: 'food',
    category: 'discount',
    description: '20% discount and VAT exemption on groceries, medicine and meals.',
    lgu: 'National / All LGUs',
  },
  {
    id: '4',
    title: 'Free Transport Fare',
    dateAndLocation: 'Mar 01, 2026 • Lapu-Lapu City',
    iconKey: 'transport',
    category: 'transport',
    description: 'Free jeepney and bus rides on selected routes with your Senior ID.',
    lgu: 'Lapu-Lapu City',
  },
];

export const mockUserNotes = `**Likes**
- Talking about her grandchildren
- Morning walks

**Concerns**
- Needs help understanding pension claims`;

export const mockAnswer = `Para makakuha sa **Social Pension**, buhata ang mosunod:

1. Adto sa inyong **OSCA office** dala ang Senior Citizen ID.
2. Mag-fill up og application form.
3. Hulaton ang pag-verify sa imong dokumento.

> Tabangan ka namo sa matag lakang, Lola/Lolo.`;
