import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types matching the schema
export interface ConferenceRow {
  id: string;
  title: string;
  description: string | null;
  sub: string | null;
  created_at: string;
  updated_at: string;
}

export interface RankRow {
  id: string;
  conference_id: string;
  ccf: string | null;
  core: string | null;
  thcpl: string | null;
  created_at: string;
}

export interface ConferenceInstanceRow {
  id: string;
  conference_id: string;
  year: number;
  date: string | null;
  place: string | null;
  timezone: string | null;
  link: string | null;
  created_at: string;
}

export interface TimelineItemRow {
  id: string;
  instance_id: string;
  deadline: string | null;
  abstract_deadline: string | null;
  comment: string | null;
  created_at: string;
}

// Helper function to fetch all conferences with their relations
export async function getConferencesFromDB() {
  const { data: conferences, error } = await supabase
    .from('conferences')
    .select(`
      id,
      title,
      description,
      sub,
      ranks (
        ccf,
        core,
        thcpl
      ),
      conference_instances (
        id,
        year,
        date,
        place,
        timezone,
        link,
        timeline_items (
          deadline,
          abstract_deadline,
          comment
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching conferences:', error);
    throw error;
  }

  // Debug: log first conference's rank data
  if (conferences && conferences.length > 0) {
    console.log('[DEBUG] First conference ranks data:', conferences[0].ranks);
    console.log('[DEBUG] Sample conferences with ranks:', conferences.slice(0, 3).map(c => ({ title: c.title, ranks: c.ranks })));
  }

  // Transform to match the original Conference type
  return conferences?.map(conf => ({
    id: conf.id,
    title: conf.title,
    description: conf.description,
    sub: conf.sub,
    rank: conf.ranks ? {
      ccf: conf.ranks.ccf,
      core: conf.ranks.core,
      thcpl: conf.ranks.thcpl
    } : undefined,
    confs: conf.conference_instances?.map(instance => ({
      year: instance.year,
      date: instance.date,
      place: instance.place,
      timezone: instance.timezone,
      link: instance.link,
      timeline: instance.timeline_items?.map(item => ({
        deadline: item.deadline,
        abstract_deadline: item.abstract_deadline,
        comment: item.comment
      })) || []
    })) || []
  })) || [];
}
