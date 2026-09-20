import axios from 'axios';
import { M3UChannel, LiveStream, Category } from '@/types';

export function parseM3U(content: string): M3UChannel[] {
  const lines = content.split(/\r?\n/);
  const channels: M3UChannel[] = [];
  
  let currentChannel: Partial<M3UChannel> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    if (line.startsWith('#EXTINF:')) {
      currentChannel = {};
      
      const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
      const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      
      if (tvgIdMatch) currentChannel.tvgId = tvgIdMatch[1];
      if (tvgNameMatch) currentChannel.tvgName = tvgNameMatch[1];
      if (tvgLogoMatch) currentChannel.logo = tvgLogoMatch[1];
      if (groupTitleMatch) currentChannel.group = groupTitleMatch[1];
      
      const nameParts = line.split(',');
      if (nameParts.length > 1) {
        currentChannel.name = nameParts[nameParts.length - 1].trim();
      } else {
        currentChannel.name = 'Unknown Channel';
      }
      
    } else if (!line.startsWith('#')) {
      if (currentChannel) {
        currentChannel.url = line;
        
        channels.push({
          name: currentChannel.name || 'Unknown Channel',
          logo: currentChannel.logo || '',
          group: currentChannel.group || 'Uncategorized',
          url: currentChannel.url,
          tvgId: currentChannel.tvgId || '',
          tvgName: currentChannel.tvgName || ''
        });
        currentChannel = null;
      }
    }
  }
  
  return channels;
}

export async function fetchAndParseM3U(url: string): Promise<M3UChannel[]> {
  try {
    const response = await axios.get(url, { responseType: 'text', timeout: 15000 });
    return parseM3U(response.data);
  } catch (error: any) {
    throw new Error(`Failed to fetch M3U playlist: ${error.message}`);
  }
}

export function m3uChannelsToLiveStreams(channels: M3UChannel[]): LiveStream[] {
  return channels.map((channel, index) => ({
    num: index + 1,
    name: channel.name,
    stream_type: 'live',
    stream_id: index + 1,
    stream_icon: channel.logo,
    epg_channel_id: channel.tvgId || '',
    added: '',
    category_id: channel.group,
    custom_sid: '',
    tv_archive: 0,
    direct_source: channel.url,
    tv_archive_duration: 0
  }));
}

export function m3uChannelsToCategories(channels: M3UChannel[]): Category[] {
  const groups = new Set<string>();
  channels.forEach(ch => {
    if (ch.group) {
      groups.add(ch.group);
    }
  });
  
  let i = 1;
  return Array.from(groups).map(group => ({
    category_id: group,
    category_name: group,
    parent_id: 0
  }));
}
