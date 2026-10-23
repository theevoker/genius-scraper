export interface Song {
  id?: number | string;
  title: string;
  url?: string;
  enabled?: boolean;
}

export type FilterData = Record<string, Song[]>;

export interface ScrapeArtistCandidate {
  id: number | string;
  name: string;
  url: string;
  alternate_names?: string[];
  similarityScore?: number;
}

export interface AddArtistResult {
  success: boolean;
  message: string;
  artistName: string;
  songCount: number;
  alreadyExisted: boolean;
  data: FilterData;
}
