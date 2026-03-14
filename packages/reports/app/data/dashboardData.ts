export type MarkerTone =
  | 'negative'
  | 'positive'
  | 'neutral'
  | 'disgust'
  | 'fear'
  | 'surprise'
  | 'sadness';

export interface FilterData {
  readonly label: string;
  readonly value: string;
}

export interface FilterOptions {
  readonly projects: readonly string[];
  readonly platforms: readonly string[];
  readonly narratives: readonly string[];
}

export interface SummarySegmentData {
  readonly label: string;
  readonly value: string;
  readonly icon: 'posts' | 'engagements' | 'authors' | 'topics' | 'sentiment' | 'emotions';
}

export interface MetricItem {
  readonly label: string;
  readonly value: string;
  readonly percentage?: string;
  readonly markerTone?: MarkerTone;
}

export interface MetricSection {
  readonly heading?: string;
  readonly rows: readonly MetricItem[];
}

export interface DataColumnData {
  readonly title: string;
  readonly sections: readonly MetricSection[];
}

export const filters: readonly FilterData[] = [
  { label: 'PROJECT', value: 'Arms Escalation in Belarus (Training)' },
  { label: 'PLATFORM', value: 'Twitter' },
  { label: 'NARRATIVE', value: 'All' },
];

export const filterOptions: FilterOptions = {
  projects: [
    'Arms Escalation in Belarus (Training)',
    'Cross-Border Influence Monitoring',
    'Election Narrative Simulation',
  ],
  platforms: ['Twitter', 'Telegram', 'Reddit'],
  narratives: ['All', 'Racial Equality Advocacy', 'Geopolitical Escalation'],
};

export const summarySegments: readonly SummarySegmentData[] = [
  { label: 'POSTS', value: '349,295', icon: 'posts' },
  { label: 'ENGAGEMENTS', value: '1,531,759', icon: 'engagements' },
  { label: 'AUTHORS', value: '147,388', icon: 'authors' },
  { label: 'TOPICS', value: 'Racial Equality Advocacy', icon: 'topics' },
  { label: 'SENTIMENT', value: '16.8% Negative', icon: 'sentiment' },
  { label: 'EMOTIONS', value: '15.4% Anger', icon: 'emotions' },
];

export const columns: readonly DataColumnData[] = [
  {
    title: 'POSTS',
    sections: [
      {
        rows: [
          { label: 'Original Posts', value: '97,063', percentage: '27.8%' },
          { label: 'Local Shared Posts', value: '252,232', percentage: '72.2%' },
          { label: 'Anomalous Posts', value: '41,710', percentage: '11.9%' },
          { label: 'Toxic Posts', value: '69,777', percentage: '20%' },
        ],
      },
    ],
  },
  {
    title: 'ENGAGEMENTS',
    sections: [
      {
        rows: [
          { label: 'Engagements on High Risk Posts', value: '217,606', percentage: '14.2%' },
          { label: 'Likes', value: '1,285,251', percentage: '83.9%' },
          { label: 'Global Shares', value: '246,508', percentage: '16.1%' },
        ],
      },
    ],
  },
  {
    title: 'AUTHORS',
    sections: [
      {
        rows: [{ label: 'Bot-Like Authors', value: '9,865', percentage: '6.7%' }],
      },
      {
        heading: 'COHORTS',
        rows: [
          { label: 'Ukraine Supporter', value: '49,517', percentage: '14.2%' },
          { label: 'Left Wing', value: '40,111', percentage: '11.5%' },
          { label: 'Russian State Supporter', value: '30,362', percentage: '8.7%' },
          { label: 'Russian State Critic', value: '17,308', percentage: '5%' },
          { label: 'Right Wing', value: '16,635', percentage: '4.8%' },
          { label: 'NATO Advocate', value: '9,991', percentage: '2.9%' },
        ],
      },
    ],
  },
  {
    title: 'TOPICS',
    sections: [
      {
        rows: [
          { label: 'Racial Equality Advocacy', value: '89,247', percentage: '25.6%' },
          { label: 'user_UkraineSupporter', value: '40,850', percentage: '11.7%' },
          { label: 'Environmental Issues Advocacy', value: '31,136', percentage: '8.9%' },
          { label: 'Crypto Support', value: '31,136', percentage: '8.9%' },
          { label: 'user_RussianStateSupporter', value: '28,300', percentage: '8.1%' },
          { label: 'user_LeftWing', value: '26,592', percentage: '7.6%' },
          { label: 'user_RightWing', value: '11,255', percentage: '3.2%' },
          { label: 'user_partisanship', value: '10,878', percentage: '3.1%' },
        ],
      },
    ],
  },
  {
    title: 'SENTIMENT',
    sections: [
      {
        rows: [
          { label: 'Negative', value: '58,801', percentage: '16.8%', markerTone: 'negative' },
          { label: 'Positive', value: '6,816', percentage: '2%', markerTone: 'positive' },
          { label: 'Neutral', value: '284,608', percentage: '81.5%', markerTone: 'neutral' },
        ],
      },
    ],
  },
  {
    title: 'EMOTIONS',
    sections: [
      {
        rows: [
          { label: 'Anger', value: '53,715', percentage: '15.4%', markerTone: 'negative' },
          { label: 'Happiness', value: '6,849', percentage: '2%', markerTone: 'positive' },
          { label: 'Disgust', value: '3,059', percentage: '0.9%', markerTone: 'disgust' },
          { label: 'Fear', value: '2,314', percentage: '0.7%', markerTone: 'fear' },
          { label: 'Surprise', value: '2,207', percentage: '0.6%', markerTone: 'surprise' },
          { label: 'Sadness', value: '1,271', percentage: '0.4%', markerTone: 'sadness' },
          { label: 'Neutral', value: '169,287', percentage: '48.5%', markerTone: 'neutral' },
        ],
      },
    ],
  },
];
