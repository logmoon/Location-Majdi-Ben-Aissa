/**
 * houseService tests
 */

import { createSupabaseMock } from './helpers/supabaseMock';

const { builder, setResponse, resetBuilder } = createSupabaseMock();

jest.mock('../lib/supabase', () => ({
  supabase: builder,
  getAdminClient: () => builder,
  default:  { supabase: builder },
}));

import { houseService } from '../app/services/houseService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const dbHouseRow = {
  id: 1,
  name: 'Maison 1',
  description: 'S+2 - First floor',
  code: '1-1',
  price: 150,
  house_images: [
    { id: 'img-1', house_id: 1, url: 'https://example.com/img1.jpg', sort_order: 0 },
    { id: 'img-2', house_id: 1, url: 'https://example.com/img2.jpg', sort_order: 1 },
  ],
};

beforeEach(() => resetBuilder());

// ─── fetchHouses ──────────────────────────────────────────────────────────────

describe('houseService.fetchHouses', () => {
  it('returns mapped houses with images on success', async () => {
    setResponse([dbHouseRow]);

    const result = await houseService.fetchHouses();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].name).toBe('Maison 1');
    expect(result[0].description).toBe('S+2 - First floor');
    expect(result[0].code).toBe('1-1');
    expect(result[0].price).toBe(150);
  });

  it('maps house_images into the images array', async () => {
    setResponse([dbHouseRow]);

    const result = await houseService.fetchHouses();

    expect(result[0].images).toHaveLength(2);
    expect(result[0].images![0].id).toBe('img-1');
    expect(result[0].images![0].url).toBe('https://example.com/img1.jpg');
    expect(result[0].images![0].sortOrder).toBe(0);
    expect(result[0].images![1].id).toBe('img-2');
  });

  it('returns an empty images array when house_images is empty', async () => {
    setResponse([{ ...dbHouseRow, house_images: [] }]);
    expect((await houseService.fetchHouses())[0].images).toEqual([]);
  });

  it('returns [] on error', async () => {
    setResponse(null, { message: 'DB error' });
    expect(await houseService.fetchHouses()).toEqual([]);
  });

  it('calls .select with the joined query', async () => {
    setResponse([]);
    await houseService.fetchHouses();
    expect(builder.select).toHaveBeenCalledWith('*, house_images(*)');
  });

  it('calls .order("id")', async () => {
    setResponse([]);
    await houseService.fetchHouses();
    expect(builder.order).toHaveBeenCalledWith('id');
  });

  it('defaults description, code, price when null', async () => {
    setResponse([{ id: 2, name: 'Test', description: null, code: null, price: null, house_images: [] }]);
    const result = await houseService.fetchHouses();
    expect(result[0].description).toBe('');
    expect(result[0].code).toBe('');
    expect(result[0].price).toBe(0);
  });

  it('maps multiple houses correctly', async () => {
    setResponse([dbHouseRow, { ...dbHouseRow, id: 2, name: 'Maison 2', code: '1-2', house_images: [] }]);
    const result = await houseService.fetchHouses();
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe(2);
    expect(result[1].name).toBe('Maison 2');
  });
});

// ─── addHouse ─────────────────────────────────────────────────────────────────

describe('houseService.addHouse', () => {
  const newHouse = { name: 'Maison 6', description: 'Top floor', code: '4-1', price: 200 };

  it('returns the new id on success', async () => {
    setResponse({ id: 6 });
    expect(await houseService.addHouse(newHouse)).toBe(6);
  });

  it('returns null on error', async () => {
    setResponse(null, { message: 'Insert failed' });
    expect(await houseService.addHouse(newHouse)).toBeNull();
  });

  it('calls .insert with correct payload', async () => {
    setResponse({ id: 6 });
    await houseService.addHouse(newHouse);
    expect(builder.insert).toHaveBeenCalledWith({
      name: 'Maison 6', description: 'Top floor', code: '4-1', price: 200,
    });
  });

  it('calls from("houses")', async () => {
    setResponse({ id: 6 });
    await houseService.addHouse(newHouse);
    expect(builder.from).toHaveBeenCalledWith('houses');
  });
});

// ─── updateHouse ──────────────────────────────────────────────────────────────

describe('houseService.updateHouse', () => {
  const house = { id: 1, name: 'Maison 1 Updated', description: 'New desc', code: '1-1', price: 175 };

  it('returns true on success', async () => {
    setResponse(null);
    expect(await houseService.updateHouse(house)).toBe(true);
  });

  it('returns false on error', async () => {
    setResponse(null, { message: 'Update failed' });
    expect(await houseService.updateHouse(house)).toBe(false);
  });

  it('calls .update with correct payload', async () => {
    setResponse(null);
    await houseService.updateHouse(house);
    expect(builder.update).toHaveBeenCalledWith({
      name: 'Maison 1 Updated', description: 'New desc', code: '1-1', price: 175,
    });
  });

  it('calls .eq("id", ...) with the correct id', async () => {
    setResponse(null);
    await houseService.updateHouse(house);
    expect(builder.eq).toHaveBeenCalledWith('id', 1);
  });
});

// ─── deleteHouse ──────────────────────────────────────────────────────────────

describe('houseService.deleteHouse', () => {
  it('returns true on success', async () => {
    setResponse(null);
    expect(await houseService.deleteHouse(1)).toBe(true);
  });

  it('returns false on error', async () => {
    setResponse(null, { message: 'Delete failed' });
    expect(await houseService.deleteHouse(1)).toBe(false);
  });

  it('calls .delete() then .eq("id", ...) with the correct id', async () => {
    setResponse(null);
    await houseService.deleteHouse(1);
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 1);
  });

  it('calls from("houses")', async () => {
    setResponse(null);
    await houseService.deleteHouse(1);
    expect(builder.from).toHaveBeenCalledWith('houses');
  });
});
