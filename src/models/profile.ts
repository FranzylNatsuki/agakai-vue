/** The logged-in senior's record, mirroring the `user` table in Supabase. */
export interface Profile {
  id: number;
  name: string;
  email: string;
  seniorId: string;
  mobileNo: string;
  age: number;
  birthday: string;
  address: string;
  gender: string;
}

export function firstName(profile: Pick<Profile, 'name'>): string {
  return profile.name.trim().split(' ')[0] ?? '';
}

export function profileFromJson(json: Record<string, any>): Profile {
  const pick = (...vals: unknown[]) =>
    vals.find((v) => v != null && String(v).trim() !== '');

  return {
    id: Number(json.id ?? 0),
    name: json.name ?? '',
    email: json.email ?? '',
    seniorId: String(pick(json.senior_id, json.seniorId) ?? ''),
    mobileNo: String(pick(json.mobileNo, json.mobile_no, json.mobile) ?? ''),
    age: Number(json.age ?? 0),
    birthday: json.birthday ?? '',
    address: json.address ?? '',
    gender: json.gender ?? '',
  };
}
