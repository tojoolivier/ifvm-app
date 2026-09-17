import { AuthError, NetworkError } from '@/lib/errors';
import { telechargerEtPartagerPdf, type PdfPartageDeps } from '@/lib/pdf-partage';

function deps(overrides: Partial<PdfPartageDeps> = {}): PdfPartageDeps {
  return {
    lireToken: async () => 'un-jeton',
    baseUrl: () => 'http://backend.local',
    fetcher: async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    ecrire: async () => 'file:///cache/fiche.pdf',
    partager: async () => {},
    ...overrides,
  };
}

describe('telechargerEtPartagerPdf', () => {
  it('appelle le endpoint avec le jeton, écrit le fichier puis le partage', async () => {
    const appels: { url: string; token: string | null }[] = [];
    const ecritures: { nomFichier: string; contenu: Uint8Array }[] = [];
    const partages: string[] = [];

    await telechargerEtPartagerPdf(
      deps({
        fetcher: async (url, token) => {
          appels.push({ url, token });
          return new Response(new Uint8Array([9, 9]), { status: 200 });
        },
        ecrire: async (nomFichier, contenu) => {
          ecritures.push({ nomFichier, contenu });
          return 'file:///cache/fiche-vol.pdf';
        },
        partager: async (uri) => {
          partages.push(uri);
        },
      }),
      '/fiches-vol/1/pdf',
      'fiche-vol.pdf'
    );

    expect(appels).toEqual([
      { url: 'http://backend.local/fiches-vol/1/pdf', token: 'un-jeton' },
    ]);
    expect(ecritures[0].nomFichier).toBe('fiche-vol.pdf');
    expect(Array.from(ecritures[0].contenu)).toEqual([9, 9]);
    expect(partages).toEqual(['file:///cache/fiche-vol.pdf']);
  });

  it('lève une NetworkError si le fetch échoue (serveur injoignable)', async () => {
    await expect(
      telechargerEtPartagerPdf(
        deps({
          fetcher: async () => {
            throw new Error('panne réseau');
          },
        }),
        '/fiches-vol/1/pdf',
        'fiche-vol.pdf'
      )
    ).rejects.toThrow(NetworkError);
  });

  it('lève une AuthError sur un 401', async () => {
    await expect(
      telechargerEtPartagerPdf(
        deps({
          fetcher: async () => new Response(null, { status: 401 }),
        }),
        '/fiches-vol/1/pdf',
        'fiche-vol.pdf'
      )
    ).rejects.toThrow(AuthError);
  });

  it('lève une NetworkError sur un statut HTTP en échec hors 401', async () => {
    await expect(
      telechargerEtPartagerPdf(
        deps({
          fetcher: async () => new Response(null, { status: 500 }),
        }),
        '/traitements/1/pdf',
        'traitement.pdf'
      )
    ).rejects.toThrow(NetworkError);
  });
});
