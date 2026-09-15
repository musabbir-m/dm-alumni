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
// Images and counts are placeholders pending MongoDB-backed batch data.
export const batches: Batch[] = [
  {
    year: '2011',
    session: '2011-12',
    batchNo: '1st',
    label: 'Pioneers',
    motto: 'The first to answer the call',
    image:
      'https://images.pexels.com/photos/6647008/pexels-photo-6647008.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 42,
  },
  {
    year: '2012',
    session: '2012-13',
    batchNo: '2nd',
    label: 'Vanguard',
    motto: 'Rising to every challenge',
    image:
      'https://images.pexels.com/photos/6646918/pexels-photo-6646918.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 56,
  },
  {
    year: '2013',
    session: '2013-14',
    batchNo: '3rd',
    label: 'Resilience',
    motto: 'Unbroken through the storm',
    image:
      'https://images.pexels.com/photos/6646770/pexels-photo-6646770.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 63,
  },
  {
    year: '2014',
    session: '2014-15',
    batchNo: '4th',
    label: 'Horizon',
    motto: 'New frontiers of preparedness',
    image:
      'https://images.pexels.com/photos/6647115/pexels-photo-6647115.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 71,
  },
  {
    year: '2015',
    session: '2015-16',
    batchNo: '5th',
    label: 'Tide',
    motto: 'Strength that rises together',
    image:
      'https://images.pexels.com/photos/12091690/pexels-photo-12091690.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 68,
  },
  {
    year: '2016',
    session: '2016-17',
    batchNo: '6th',
    label: 'Beacon',
    motto: 'Light in the aftermath',
    image:
      'https://images.pexels.com/photos/6646869/pexels-photo-6646869.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 79,
  },
  {
    year: '2017',
    session: '2017-18',
    batchNo: '7th',
    label: 'Harbor',
    motto: 'Shelter built from experience',
    image:
      'https://images.pexels.com/photos/6647008/pexels-photo-6647008.jpeg?auto=compress&cs=tinysrgb&w=1600',
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
