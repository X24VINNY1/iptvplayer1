import axios, { AxiosInstance } from 'axios';
import {
  XtreamAuth,
  Category,
  LiveStream,
  VodStream,
  VodInfo,
  Series,
  SeriesInfo,
  EPGEntry,
} from '@/types';
import { normalizeServerUrl } from '@/utils/url';

export class XtreamAPI {
  private client: AxiosInstance;
  public serverUrl: string;
  public username: string;
  private password: string;

  constructor(serverUrl: string, username: string, password: string) {
    this.serverUrl = normalizeServerUrl(serverUrl);
    this.username = username;
    this.password = password;

    this.client = axios.create({
      baseURL: this.serverUrl,
      timeout: 15000,
    });
  }

  private async get<T>(params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.get('/player_api.php', {
        params: {
          username: this.username,
          password: this.password,
          ...params,
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Server error: ${error.response.status}`);
      } else if (error.request) {
        throw new Error('Network error: Server unavailable or request timed out');
      } else {
        throw new Error(`Error: ${error.message}`);
      }
    }
  }

  public async authenticate(): Promise<XtreamAuth> {
    const data = await this.get<XtreamAuth>();
    if (!data || !data.user_info) {
      throw new Error('Invalid response from server');
    }
    if (data.user_info.auth !== 1) {
      throw new Error('Invalid credentials or authentication failed');
    }
    if (data.user_info.status !== 'Active' && data.user_info.status !== 'Trial') {
      throw new Error(`Account status: ${data.user_info.status}`);
    }
    return data;
  }

  public async getLiveCategories(): Promise<Category[]> {
    return this.get<Category[]>({ action: 'get_live_categories' });
  }

  public async getLiveStreams(categoryId?: string): Promise<LiveStream[]> {
    const params: any = { action: 'get_live_streams' };
    if (categoryId) params.category_id = categoryId;
    return this.get<LiveStream[]>(params);
  }

  public async getVodCategories(): Promise<Category[]> {
    return this.get<Category[]>({ action: 'get_vod_categories' });
  }

  public async getVodStreams(categoryId?: string): Promise<VodStream[]> {
    const params: any = { action: 'get_vod_streams' };
    if (categoryId) params.category_id = categoryId;
    return this.get<VodStream[]>(params);
  }

  public async getVodInfo(vodId: number): Promise<VodInfo> {
    return this.get<VodInfo>({ action: 'get_vod_info', vod_id: vodId });
  }

  public async getSeriesCategories(): Promise<Category[]> {
    return this.get<Category[]>({ action: 'get_series_categories' });
  }

  public async getSeries(categoryId?: string): Promise<Series[]> {
    const params: any = { action: 'get_series' };
    if (categoryId) params.category_id = categoryId;
    return this.get<Series[]>(params);
  }

  public async getSeriesInfo(seriesId: number): Promise<SeriesInfo> {
    return this.get<SeriesInfo>({ action: 'get_series_info', series_id: seriesId });
  }

  public async getShortEPG(streamId: number, limit?: number): Promise<EPGEntry[]> {
    const params: any = { action: 'get_short_epg', stream_id: streamId };
    if (limit) params.limit = limit;
    const response = await this.get<{ epg_listings: EPGEntry[] }>(params);
    return response.epg_listings || [];
  }

  public getLiveStreamUrl(streamId: number, extension: string = 'm3u8'): string {
    return `${this.serverUrl}/live/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  public getVodStreamUrl(streamId: number, extension: string): string {
    return `${this.serverUrl}/movie/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  public getSeriesStreamUrl(streamId: number, extension: string): string {
    return `${this.serverUrl}/series/${this.username}/${this.password}/${streamId}.${extension}`;
  }
}
