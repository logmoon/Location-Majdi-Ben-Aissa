// Houses.ts - Contains information about the rental houses

export interface HouseImage {
  id: string;
  houseId: number;
  url: string;
  sortOrder: number;
}

export interface House {
  id: number;
  name: string;
  description: string;
  code: string;
  price: number;
  images?: HouseImage[];
}

export const HOUSES: House[] = [
  {
    id: 1,
    name: 'Maison 1',
    description: 'S+2 - Première étage - Maison 1',
    code: '1-1',
    price: 0,
  },
  {
    id: 2,
    name: 'Maison 2',
    description: 'S+2 - Première étage - Maison 2',
    code: '1-2',
    price: 0,
  },
  {
    id: 3,
    name: 'Maison 3',
    description: 'S+2 - Deuxième étage - Maison 1',
    code: '2-1',
    price: 0,
  },
  {
    id: 4,
    name: 'Maison 4',
    description: 'S+2 - Deuxième étage - Maison 2',
    code: '2-2',
    price: 0,
  },
  {
    id: 5,
    name: 'Maison 5',
    description: 'S+2 - Troisième étage - Maison 1',
    code: '3-1',
    price: 0,
  },
];

// Add default export to fix warning
const Houses = { HOUSES };
export default Houses;