export interface TimelineItem {
  deadline: string;
  comment?: string;
  abstract_deadline?: string;
}

export interface ConferenceInstance {
  year: number;
  id: string;
  link: string;
  timeline: TimelineItem[];
  timezone: string;
  date: string;
  place: string;
}

export interface Rank {
  ccf?: string;
  core?: string;
  thcpl?: string;
}

export interface Conference {
  title: string;
  description: string;
  sub: string;
  subName?: string;
  rank: Rank;
  dblp: string;
  confs: ConferenceInstance[];
  sourceFile: string;
}
