import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'InvestmentScreen.tsx'), 'utf8');

describe('company portfolio UI', () => {
  it('shows holdings, sector filters and per-company invest actions without the removed token market', () => {
    expect(source).toContain('MY PORTFOLIO');
    expect(source).toContain('Company Market');
    expect(source).toContain('STOCK_SECTORS.map');
    expect(source).toContain("flexWrap: 'wrap'");
    expect(source).toContain('investActionTextOwned');
    expect(source).toContain("setTrade({ kind: 'BUY', companyId: company.id })");
    expect(source).toContain("setTrade({ kind: 'SELL', companyId: holding.companyId })");
    expect(source).toContain('Sell amount');
    expect(source).toContain('Sell all');
    expect(source).not.toContain('Legacy Token');
  });
});
