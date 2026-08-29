import type { StockCompany, StockRisk, StockSector } from '../domain/types';

export const STOCK_SECTORS: readonly StockSector[] = [
  'TECHNOLOGY',
  'INFRASTRUCTURE',
  'MINING',
  'ENERGY',
  'CONSUMER',
  'MANUFACTURING',
  'LOGISTICS',
  'HEALTHCARE',
] as const;

export const STOCK_SECTOR_LABELS: Record<StockSector, string> = {
  TECHNOLOGY: 'Technology',
  INFRASTRUCTURE: 'Infrastructure',
  MINING: 'Mining',
  ENERGY: 'Energy',
  CONSUMER: 'Consumer',
  MANUFACTURING: 'Manufacturing',
  LOGISTICS: 'Logistics',
  HEALTHCARE: 'Healthcare',
};

/** Fully fictional companies. They are not based on real listed businesses. */
export const STOCK_COMPANIES: readonly StockCompany[] = [
  { id: 'nimbus_logic', name: 'Nimbus Logic', sector: 'TECHNOLOGY', risk: 'VOLATILE' },
  { id: 'prismgrid_systems', name: 'PrismGrid Systems', sector: 'TECHNOLOGY', risk: 'BALANCED' },
  { id: 'orbitlink_digital', name: 'OrbitLink Digital', sector: 'TECHNOLOGY', risk: 'VOLATILE' },

  { id: 'stonebridge_infra', name: 'Stonebridge Infra', sector: 'INFRASTRUCTURE', risk: 'STABLE' },
  {
    id: 'metrospan_engineering',
    name: 'MetroSpan Engineering',
    sector: 'INFRASTRUCTURE',
    risk: 'BALANCED',
  },
  {
    id: 'keystone_projects',
    name: 'Keystone Projects',
    sector: 'INFRASTRUCTURE',
    risk: 'BALANCED',
  },

  { id: 'redcliff_minerals', name: 'Redcliff Minerals', sector: 'MINING', risk: 'VOLATILE' },
  { id: 'ironvale_resources', name: 'Ironvale Resources', sector: 'MINING', risk: 'BALANCED' },
  { id: 'silvercrest_metals', name: 'Silvercrest Metals', sector: 'MINING', risk: 'VOLATILE' },

  { id: 'sunforge_renewables', name: 'Sunforge Renewables', sector: 'ENERGY', risk: 'BALANCED' },
  { id: 'bluecurrent_energy', name: 'BlueCurrent Energy', sector: 'ENERGY', risk: 'VOLATILE' },
  { id: 'northstar_power', name: 'Northstar Power', sector: 'ENERGY', risk: 'STABLE' },

  { id: 'fieldstone_foods', name: 'Fieldstone Foods', sector: 'CONSUMER', risk: 'STABLE' },
  { id: 'crownleaf_beverages', name: 'Crownleaf Beverages', sector: 'CONSUMER', risk: 'BALANCED' },
  { id: 'harbour_retail', name: 'Harbour Retail', sector: 'CONSUMER', risk: 'BALANCED' },

  { id: 'meridian_motors', name: 'Meridian Motors', sector: 'MANUFACTURING', risk: 'BALANCED' },
  {
    id: 'aeroforge_industries',
    name: 'AeroForge Industries',
    sector: 'MANUFACTURING',
    risk: 'VOLATILE',
  },
  { id: 'titanworks', name: 'TitanWorks', sector: 'MANUFACTURING', risk: 'STABLE' },

  { id: 'atlas_freightways', name: 'Atlas Freightways', sector: 'LOGISTICS', risk: 'STABLE' },
  { id: 'portline_logistics', name: 'Portline Logistics', sector: 'LOGISTICS', risk: 'BALANCED' },
  { id: 'skyroute_cargo', name: 'SkyRoute Cargo', sector: 'LOGISTICS', risk: 'VOLATILE' },

  { id: 'vitalis_healthcare', name: 'Vitalis Healthcare', sector: 'HEALTHCARE', risk: 'STABLE' },
  { id: 'medora_labs', name: 'Medora Labs', sector: 'HEALTHCARE', risk: 'VOLATILE' },
  { id: 'wellspring_pharma', name: 'WellSpring Pharma', sector: 'HEALTHCARE', risk: 'BALANCED' },
] as const;

export const STOCK_RISK_LABELS: Record<StockRisk, string> = {
  STABLE: 'Stable',
  BALANCED: 'Balanced',
  VOLATILE: 'Volatile',
};

export function stockCompany(companyId: string): StockCompany | undefined {
  return STOCK_COMPANIES.find((company) => company.id === companyId);
}
