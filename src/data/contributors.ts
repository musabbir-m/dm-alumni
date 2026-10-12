/**
 * Static contributor roster for the homepage's Contributors section.
 *
 * `batch` is the session-start year — the same key as `Batch.year` in
 * batches.ts ('2013' renders as "DSM 3rd Batch (Session 2013-14)").
 *
 * `photo` points at real portraits served from `public/contributor-images/`
 * where provided (file name carries the person + batch). Contributors
 * without a photo yet render the shared person-icon placeholder — leave
 * `photo` unset and drop a matching file into that folder (or fill
 * `studentId` to pull from the members collection) later. The shared
 * `ishtiak` object keeps both of his cards on the same face.
 */
export interface Contributor {
  name: string;
  /** Session-start year — key into batches.ts ('2013' = DSM 3rd Batch) */
  batch: string;
  /** Roster student ID — reserved for photo/directory enrichment */
  studentId?: string;
  /** Profile photo URL — served from public/contributor-images/ */
  photo?: string;
}

/** Executive roles — one person each, the "Core Team" row */
export const coreTeam: { role: string; member: Contributor }[] = [
  {
    role: 'Convener',
    member: { name: 'Roquia Salam', batch: '2013', photo: '/contributor-images/Roquia-dsm3rd.jpeg' },
  },
  {
    role: 'Secretary',
    member: { name: 'Md. Siddiqur Rahman', batch: '2014', photo: '/contributor-images/Siddiqur-dsm4th.jpg' },
  },
  {
    role: 'Treasurer',
    member: { name: 'Md. Wasiq Mamun Sajid', batch: '2015', photo: '/contributor-images/Sajid-dsm5th.jpeg' },
  },
];

/** On both the committee row and the Website Design & Development row */
const ishtiak: Contributor = {
  name: 'Md. Ishtiak Abedin',
  batch: '2015',
  photo: '/contributor-images/Ishtiak-dsm5.png',
};

/** Constitution Drafting Committee — one row; the row label carries the role */
export const committeeMembers: Contributor[] = [
  { name: 'A K Azad Suborno', batch: '2014' },
  ishtiak,
  { name: 'Syed Nazmus Sakib', batch: '2016' },
];

/** Website Design & Development — one row, one card per contribution */
export const designTeam: { role: string; member: Contributor }[] = [
  {
    role: 'Website Design & Development',
    member: { name: 'Md Musabbir', batch: '2014', photo: '/contributor-images/Musabbir-dsm4th.jpeg' },
  },
  { role: 'Logo Design', member: ishtiak },
];

/** Liaison with the parent student association */
const liaisonLead: Contributor = {
  name: 'Nur-A-Moula',
  batch: '2019',
};
export const liaison = {
  organization: 'Association of Disaster Science and Management (ADMS)',
  committee: 'Committee 2025–2026',
  lead: liaisonLead,
};

/** Well-wishers who supported founding the association */
export const supporters: Contributor[] = [
  { name: 'Manosh Roy', batch: '2011' },
  { name: 'MU Islam Hridoy', batch: '2011' },
  { name: 'Sheikh Sadi', batch: '2011' },
  { name: 'Al Mamun', batch: '2011' },
  { name: 'Nafiuzzaman Nayeem', batch: '2012' },
  { name: 'Mosiur Rahman Moshi', batch: '2012' },
  { name: 'Mahzabin Binte Rahman', batch: '2013' },
  { name: 'Ahnaf Tahmid', batch: '2013' },
  { name: 'Sajjad Hossain Shozib', batch: '2013' },
  { name: 'Adnan Sarker Apon', batch: '2014' },
  { name: 'Khalid Saifullah', batch: '2016' },
  { name: 'Nourin Nova', batch: '2017' },
  { name: 'Mohammad Harun', batch: '2017' },
  { name: 'AB Masud', batch: '2018' },
];
