export interface CommunityIndexEntry {
  name: string;
  display_name: string;
  description: string;
  author: string;
  version: string;
  thumbnail_url: string;
  entry_count: number;
  updated_at: string;
  origin?: string;
}

export interface CommunityIndex {
  version: number;
  atlases: CommunityIndexEntry[];
}

export interface CommunityManifest {
  installed: Record<string, { semver: string; installed_at: string }>;
}
