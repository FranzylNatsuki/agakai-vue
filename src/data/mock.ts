import type { Benefit } from '@/models/benefit';
import type { Profile } from '@/models/profile';
import type { MapLocation } from '@/models/mapLocation';

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

export const mockHealthCenterLocation: MapLocation = {
  name: 'City Health Center',
  latitude: 10.3103,
  longitude: 123.9494,
};

export const mockBenefits: Benefit[] = [
  {
    id: '1',
    title: 'Social Pension',
    dateAndLocation: 'Jan 15, 2026 • Nationwide',
    iconKey: 'pension',
    category: 'cash',
    description: 'Monthly stipend of ₱1,000 for indigent senior citizens.',
    lgu: 'National / All LGUs',
    translations: {
      ceb: {
        title: 'Pensiyon para sa Senior Citizen',
        dateAndLocation: 'Ene 15, 2026 • Sa tibuok nasod',
        description: 'Binulan nga tabang pinansyal nga ₱1,000 para sa kwalipikadong senior citizen.',
        lgu: 'Nasodnon / tanang LGU',
      },
      tl: {
        title: 'Pensiyong Panlipunan',
        dateAndLocation: 'Ene 15, 2026 • Sa buong bansa',
        description: 'Buwanang tulong pinansyal na ₱1,000 para sa kuwalipikadong senior citizen.',
        lgu: 'Pambansa / lahat ng LGU',
      },
    },
  },
  {
    id: '2',
    title: 'Free Medical Check-up',
    dateAndLocation: 'Feb 02, 2026 • Lapu-Lapu City',
    iconKey: 'medical',
    category: 'health',
    description: 'Free check-up and basic lab tests at the city health center.',
    lgu: 'Lapu-Lapu City',
    translations: {
      ceb: {
        title: 'Libre nga Medical Check-up',
        dateAndLocation: 'Peb 2, 2026 • Lapu-Lapu City',
        description: 'Libre nga check-up ug batakang laboratory test sa health center sa siyudad.',
      },
      tl: {
        title: 'Libreng Medical Check-up',
        dateAndLocation: 'Peb 2, 2026 • Lapu-Lapu City',
        description: 'Libreng check-up at mga batayang laboratory test sa health center ng lungsod.',
      },
    },
  },
  {
    id: '3',
    title: 'Senior Discount',
    dateAndLocation: 'Always • Nationwide',
    iconKey: 'food',
    category: 'discount',
    description: '20% discount and VAT exemption on groceries, medicine and meals.',
    lgu: 'National / All LGUs',
    translations: {
      ceb: {
        title: 'Diskuwento para sa Senior Citizen',
        dateAndLocation: 'Kanunay • Sa tibuok nasod',
        description: '20% nga diskuwento ug wala nay VAT sa groceries, tambal ug pagkaon.',
        lgu: 'Nasodnon / tanang LGU',
      },
      tl: {
        title: 'Diskuwento para sa Senior Citizen',
        dateAndLocation: 'Palagi • Sa buong bansa',
        description: '20% diskuwento at VAT exemption sa grocery, gamot, at pagkain.',
        lgu: 'Pambansa / lahat ng LGU',
      },
    },
  },
  {
    id: '4',
    title: 'Free Transport Fare',
    dateAndLocation: 'Mar 01, 2026 • Lapu-Lapu City',
    iconKey: 'transport',
    category: 'transport',
    description: 'Free jeepney and bus rides on selected routes with your Senior ID.',
    lgu: 'Lapu-Lapu City',
    translations: {
      ceb: {
        title: 'Libre nga Plete sa Transportasyon',
        dateAndLocation: 'Mar 1, 2026 • Lapu-Lapu City',
        description: 'Libre nga sakay sa pipiling rota sa jeepney ug bus gamit ang Senior ID.',
      },
      tl: {
        title: 'Libreng Pamasahe sa Transportasyon',
        dateAndLocation: 'Mar 1, 2026 • Lapu-Lapu City',
        description: 'Libreng sakay sa piling ruta ng jeepney at bus gamit ang Senior ID.',
      },
    },
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
