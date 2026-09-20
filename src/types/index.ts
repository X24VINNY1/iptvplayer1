export interface ServerProfile {
  id: string;
  name: string;
  serverUrl: string;
  username: string;
  password: string;
  type: 'xtream' | 'm3u';
  m3uUrl?: string;
  createdAt: number;
  lastUsed?: number;
}

export interface XtreamAuth {
  user_info: {
    username: string;
    password: string;
    message: string;
    auth: number;
    status: string;
    exp_date: string;
    is_trial: string;
    active_cons: string;
    created_at: string;
    max_connections: string;
    allowed_output_formats: string[];
  };
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    rtmp_port: string;
    timezone: string;
    timestamp_now: number;
    time_now: string;
  };
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface LiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface VodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface VodInfo {
  info: {
    movie_image: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releasedate: string;
    duration: string;
    duration_secs: number;
    bitrate: number;
    rating: string;
    name: string;
    description: string;
    backdrop_path: string[];
    youtube_trailer: string;
    tmdb_id: string;
  };
  movie_data: {
    stream_id: number;
    name: string;
    added: string;
    category_id: string;
    container_extension: string;
  };
}

export interface Series {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface Episode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    movie_image: string;
    plot: string;
    duration_secs: number;
    duration: string;
    rating: number;
    name: string;
    season: number;
  };
  custom_sid: string;
  added: string;
  season: number;
  direct_source: string;
}

export interface SeriesInfo {
  seasons: Array<{
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    season_number: number;
    cover: string;
    cover_big: string;
  }>;
  episodes: Record<string, Episode[]>;
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    releaseDate: string;
    rating: string;
    rating_5based: number;
    backdrop_path: string[];
    youtube_trailer: string;
    episode_run_time: string;
    category_id: string;
  };
}

export interface EPGEntry {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: string;
  stop_timestamp: string;
}

export interface FavoriteItem {
  id: string;
  type: 'live' | 'vod' | 'series';
  streamId: number;
  name: string;
  icon: string;
  categoryId: string;
  addedAt: number;
}

export interface HistoryItem {
  id: string;
  type: 'live' | 'vod' | 'series';
  streamId: number;
  name: string;
  icon: string;
  categoryId: string;
  watchedAt: number;
  progress?: number;
  duration?: number;
  seasonNum?: number;
  episodeNum?: number;
  episodeTitle?: string;
  seriesId?: number;
  containerExtension?: string;
}

export interface M3UChannel {
  name: string;
  logo: string;
  group: string;
  url: string;
  tvgId: string;
  tvgName: string;
}
