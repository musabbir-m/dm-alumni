export interface Batch {
  /** Session start year — the value stored in User.batch (lookup key) */
  year: string;
  /** Full academic session, e.g. '2011-12' */
  session: string;
  /** Ordinal label, e.g. '1st' */
  batchNo: string;
  /** Marketing nickname shown on cohort cards */
  label: string;
  motto: string;
  image: string;
  count: number;
}

/** Plain batch identity for dropdowns and the profile, e.g. "DSM 8th Batch (Session 2018-19)" */
export const batchName = (b: Batch) => `DSM ${b.batchNo} Batch (Session ${b.session})`;

// Batch group photos — each represents a graduating cohort.
// 1st–7th are real photos served from /batch-image (WhatsApp Image…jpeg in
// that folder is unused). 8th–10th still use stock placeholders, and counts
// are estimates — both pending MongoDB-backed batch data.
export const batches: Batch[] = [
  {
    year: '2011',
    session: '2011-12',
    batchNo: '1st',
    label: 'Pioneers',
    motto: 'The first to answer the call',
    image: '/batch-image/1st-batch.jpeg',
    count: 42,
  },
  {
    year: '2012',
    session: '2012-13',
    batchNo: '2nd',
    label: 'Vanguard',
    motto: 'Rising to every challenge',
    image: '/batch-image/2nd-batch.jpeg',
    count: 56,
  },
  {
    year: '2013',
    session: '2013-14',
    batchNo: '3rd',
    label: 'Resilience',
    motto: 'Unbroken through the storm',
    image: '/batch-image/3rd-batch.jpeg',
    count: 63,
  },
  {
    year: '2014',
    session: '2014-15',
    batchNo: '4th',
    label: 'Horizon',
    motto: 'New frontiers of preparedness',
    image: '/batch-image/4th-batch.jpeg',
    count: 71,
  },
  {
    year: '2015',
    session: '2015-16',
    batchNo: '5th',
    label: 'Tide',
    motto: 'Strength that rises together',
    image: '/batch-image/5th-batch.jpeg',
    count: 68,
  },
  {
    year: '2016',
    session: '2016-17',
    batchNo: '6th',
    label: 'Beacon',
    motto: 'Light in the aftermath',
    image: '/batch-image/6th-batch.jpeg',
    count: 79,
  },
  {
    year: '2017',
    session: '2017-18',
    batchNo: '7th',
    label: 'Harbor',
    motto: 'Shelter built from experience',
    image: '/batch-image/7th-batch.jpeg',
    count: 74,
  },
  {
    year: '2018',
    session: '2018-19',
    batchNo: '8th',
    label: 'Current',
    motto: 'Carrying change forward',
    image:
      'https://images.pexels.com/photos/6646918/pexels-photo-6646918.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 83,
  },
  {
    year: '2019',
    session: '2019-20',
    batchNo: '9th',
    label: 'Delta',
    motto: 'Where every current converges',
    image:
      'https://images.pexels.com/photos/6646770/pexels-photo-6646770.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 69,
  },
  {
    year: '2020',
    session: '2020-21',
    batchNo: '10th',
    label: 'Compass',
    motto: 'Direction for what comes next',
    image:
      'https://images.pexels.com/photos/6647115/pexels-photo-6647115.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 90,
  },
];
