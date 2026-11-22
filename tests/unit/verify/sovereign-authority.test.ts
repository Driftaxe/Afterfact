import { describe, it, expect } from 'vitest';
import { isSovereignDomain } from '@/server/jobs/worker';

describe('Sovereign Authority Classification Globally', () => {
  it('correctly classifies multi-national sovereign government, legislative, and judicial domains', () => {
    const sovereignUrls = [
      'https://www.sec.gov/edgar/searchedgar/companysearch',
      'https://www.irs.gov/individuals',
      'https://www.legislation.gov.uk/ukpga/2023/1/enacted',
      'https://transport.jharkhand.gov.in/rules/mv_rules.pdf',
      'https://indiacode.nic.in/handle/123456789/1798',
      'https://parivahan.gov.in/parivahan/',
      'https://pib.gov.in/PressReleasePage.aspx',
      'https://eur-lex.europa.eu/legal-content/EN/TXT/',
      'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006419280/',
      'https://www.digital.go.jp/policies/posts/',
      'https://www.admin.ch/gov/de/start.html',
      'https://www.gob.mx/sat',
      'https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation',
    ];

    for (const url of sovereignUrls) {
      expect(isSovereignDomain(url), `Failed to recognize sovereign domain for ${url}`).toBe(true);
    }
  });

  it('rejects commercial blogs, forums, and unvetted local sites from sovereign classification', () => {
    const nonSovereignUrls = [
      'https://navimumbai.com/rto-rules-guide',
      'https://techcrunch.com/2024/01/15/ai-startup',
      'https://medium.com/@lawblogger/vehicle-transfer',
      'https://reddit.com/r/legaladvice/comments/xyz',
      'https://quora.com/how-to-transfer-car-between-states',
      'https://random-news-portal.xyz/breaking',
    ];

    for (const url of nonSovereignUrls) {
      expect(isSovereignDomain(url), `Erroneously classified non-sovereign URL as sovereign: ${url}`).toBe(false);
    }
  });
});
