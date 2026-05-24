import { getAdminClient, supabase } from '../../lib/supabase';
import { House, HouseImage } from '../constants/Houses';

const fromDbHouse = (row: any): House => ({
  id: row.id,
  name: row.name,
  description: row.description || '',
  code: row.code || '',
  price: row.price || 0,
});

const fromDbImage = (row: any): HouseImage => ({
  id: row.id,
  houseId: row.house_id,
  url: row.url,
  sortOrder: row.sort_order,
});

export const houseService = {
  async fetchHouses(): Promise<House[]> {
    const { data, error } = await supabase
      .from('houses')
      .select('*, house_images(*)')
      .order('id');

    if (error) {
      console.error('Error fetching houses:', error);
      return [];
    }

    return (data || []).map(row => ({
      ...fromDbHouse(row),
      images: (row.house_images || []).map(fromDbImage),
    }));
  },

  async addHouse(house: Omit<House, 'id'>): Promise<number | null> {
    const { data, error } = await getAdminClient()
      .from('houses')
      .insert({
        name: house.name,
        description: house.description,
        code: house.code,
        price: house.price,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error adding house:', error);
      return null;
    }

    return data?.id || null;
  },

  async updateHouse(house: House): Promise<boolean> {
    const { error } = await getAdminClient()
      .from('houses')
      .update({
        name: house.name,
        description: house.description,
        code: house.code,
        price: house.price,
      })
      .eq('id', house.id);

    if (error) {
      console.error('Error updating house:', error);
      return false;
    }

    return true;
  },

  async deleteHouse(id: number): Promise<boolean> {
    const { error } = await getAdminClient()
      .from('houses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting house:', error);
      return false;
    }

    return true;
  },

  async fetchHouseImages(houseId: number): Promise<HouseImage[]> {
    const { data, error } = await supabase
      .from('house_images')
      .select('*')
      .eq('house_id', houseId)
      .order('sort_order');

    if (error) {
      console.error('Error fetching house images:', error);
      return [];
    }

    return (data || []).map(fromDbImage);
  },

  async uploadImage(houseId: number, uri: string): Promise<string | null> {
    try {
      const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const fileName = `house_${houseId}_${Date.now()}.${ext}`;

      // React Native can't fetch local file URIs as blobs — use FormData instead
      const formData = new FormData();
      formData.append('file', { uri, name: fileName, type: mimeType } as any);

      const { data, error } = await getAdminClient().storage
        .from('house-images')
        .upload(fileName, formData, {
          contentType: mimeType,
        });

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('house-images')
        .getPublicUrl(data.path);

      const { error: dbError } = await getAdminClient()
        .from('house_images')
        .insert({
          house_id: houseId,
          url: publicUrl,
          // Use a sequential counter capped to PostgreSQL INTEGER max (2,147,483,647).
          // Date.now() (~1.7 trillion) overflows INTEGER — use modulo to keep it safe.
          sort_order: Date.now() % 2_000_000_000,
        });

      if (dbError) {
        console.error('Error saving image record:', dbError);
        return null;
      }

      return publicUrl;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      return null;
    }
  },

  async deleteImage(imageId: string): Promise<boolean> {
    // First get the image record to find the storage path
    const { data: imageRecord, error: fetchError } = await supabase
      .from('house_images')
      .select('url')
      .eq('id', imageId)
      .single();

    if (fetchError) {
      console.error('Error fetching image record:', fetchError);
      return false;
    }

    // Delete the DB record
    const { error: dbError } = await getAdminClient()
      .from('house_images')
      .delete()
      .eq('id', imageId);

    if (dbError) {
      console.error('Error deleting image record:', dbError);
      return false;
    }

    // Delete the file from Storage — extract filename from the public URL
    if (imageRecord?.url) {
      try {
        const url = imageRecord.url as string;
        const fileName = url.split('/').pop();
        if (fileName) {
          await getAdminClient().storage.from('house-images').remove([fileName]);
        }
      } catch (storageError) {
        // Log but don't fail — DB record is already gone
        console.warn('Could not delete storage file:', storageError);
      }
    }

    return true;
  },
};

export default houseService;
