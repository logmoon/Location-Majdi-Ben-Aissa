import { Translations } from '../app/constants/Translations';

describe('Translations.clearDataConfirmWithPending', () => {
  it('uses singular agreement for exactly 1 pending change', () => {
    const msg = Translations.clearDataConfirmWithPending(1);
    expect(msg).toContain('1 modification locale');
    expect(msg).toContain("n'a pas encore été synchronisée");
    expect(msg).toContain('cette modification');
    expect(msg).not.toContain('modifications');
  });

  it('uses plural agreement for more than 1 pending change', () => {
    const msg = Translations.clearDataConfirmWithPending(5);
    expect(msg).toContain('5 modifications locales');
    expect(msg).toContain("n'ont pas encore été synchronisées");
    expect(msg).toContain('ces modifications');
  });

  it('always states the action is irreversible', () => {
    expect(Translations.clearDataConfirmWithPending(1)).toContain('irréversible');
    expect(Translations.clearDataConfirmWithPending(2)).toContain('irréversible');
  });
});
