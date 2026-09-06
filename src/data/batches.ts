export interface Batch {
  year: string;
  label: string;
  motto: string;
  image: string;
  count: number;
}

// Batch group photos — each represents a graduating cohort
export const batches: Batch[] = [
  {
    year: '2018',
    label: 'Pioneers',
    motto: 'The first to answer the call',
    image:
      'https://images.pexels.com/photos/6647008/pexels-photo-6647008.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 42,
  },
  {
    year: '2019',
    label: 'Vanguard',
    motto: 'Rising to every challenge',
    image:
      'https://images.pexels.com/photos/6646918/pexels-photo-6646918.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 56,
  },
  {
    year: '2020',
    label: 'Resilience',
    motto: 'Unbroken through the storm',
    image:
      'https://images.pexels.com/photos/6646770/pexels-photo-6646770.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 63,
  },
  {
    year: '2021',
    label: 'Horizon',
    motto: 'New frontiers of preparedness',
    image:
      'https://images.pexels.com/photos/6647115/pexels-photo-6647115.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 71,
  },
  {
    year: '2022',
    label: 'Tide',
    motto: 'Strength that rises together',
    image:
      'https://images.pexels.com/photos/12091690/pexels-photo-12091690.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 68,
  },
  {
    year: '2023',
    label: 'Beacon',
    motto: 'Light in the aftermath',
    image:
      'https://images.pexels.com/photos/6646869/pexels-photo-6646869.jpeg?auto=compress&cs=tinysrgb&w=1600',
    count: 79,
  },
];
