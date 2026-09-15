/**
 * #position-hors-madagascar : remplace le simple rectangle englobant
 * (`MADAGASCAR_BBOX` dans prospection-validation.ts) par un vrai test
 * géographique — un point en pleine mer, à l'est de l'île mais toujours dans
 * les bornes lat/lon du rectangle, passait le contrôle précédent sans être
 * réellement à Madagascar. Demande explicite du 2026-09-15 : « toute
 * tentative hors de Madagascar, même en mer, ne sera pas prise ».
 *
 * `MADAGASCAR_POLYGON` : contour de l'île (partie continentale uniquement —
 * les petites îles satellites comme Nosy Be/Sainte-Marie, très proches de la
 * côte, restent couvertes par la marge de tolérance ci-dessous), simplifié à
 * 261 sommets (tolérance Douglas-Peucker ≈ 5 km) depuis geoBoundaries
 * (ADM0, source OpenStreetMap, licence ODbL) — largement suffisant pour
 * distinguer terre/mer sans viser une précision cartographique.
 */

/** [longitude, latitude], comme une géométrie GeoJSON. */
const MADAGASCAR_POLYGON: readonly [number, number][] = [
  [49.246, -11.952], [49.1631, -12.0412], [49.224, -12.116], [49.1478, -12.0585], [49.0854, -12.1051], [49.2013, -12.1468], [49.1477, -12.2712], [48.9716, -12.3429],
  [48.9384, -12.4917], [48.8849, -12.5246], [48.851, -12.4169], [48.7613, -12.3951], [48.7203, -12.4429], [48.7725, -12.4315], [48.8246, -12.5692], [48.8901, -12.5375],
  [48.8534, -12.6665], [49.0084, -12.8965], [48.8257, -13.1304], [48.9043, -13.2691], [48.8153, -13.2962], [48.8332, -13.3856], [48.6602, -13.4614], [48.6882, -13.5289],
  [48.472, -13.3684], [48.5624, -13.5287], [48.3607, -13.6134], [48.366, -13.7512], [48.2729, -13.8291], [48.1576, -13.7623], [48.1463, -13.6013], [48.0571, -13.6516],
  [48.0623, -13.5255], [48.0002, -13.6078], [47.9715, -13.5038], [47.9782, -13.6251], [47.8926, -13.5952], [47.8834, -13.8723], [48.0463, -13.953], [47.9234, -14.0097],
  [48.0422, -14.077], [48.0172, -14.2296], [48.0653, -14.2166], [47.9842, -14.4128], [47.9984, -14.1345], [47.8877, -14.0954], [47.9614, -14.1663], [47.9304, -14.2681],
  [47.7959, -14.2185], [47.6899, -14.4447], [47.7384, -14.6147], [47.7973, -14.5442], [47.8637, -14.6103], [47.9748, -14.4832], [47.9482, -14.5927], [48.0031, -14.5764],
  [48.0573, -14.6754], [47.9987, -14.8224], [47.942, -14.8157], [47.9856, -14.8879], [47.9302, -14.8637], [47.9029, -14.9728], [47.87, -14.9123], [47.8871, -14.8197],
  [47.9349, -14.8348], [47.8968, -14.7967], [47.9773, -14.7807], [47.9758, -14.6248], [47.8782, -14.731], [47.795, -14.5704], [47.5183, -15.0998], [47.4208, -15.151],
  [47.3986, -14.9888], [47.5162, -14.8199], [47.4614, -14.6716], [47.2791, -14.8612], [47.4186, -14.8604], [47.3793, -14.9249], [47.2859, -14.9344], [47.2708, -15.0293],
  [47.2138, -14.9966], [47.2263, -15.0681], [47.0461, -15.1859], [47.0878, -15.3112], [47.1777, -15.2828], [47.1814, -15.419], [47.2946, -15.4413], [47.2027, -15.4625],
  [47.2565, -15.5024], [46.9354, -15.472], [47.072, -15.3356], [46.9557, -15.283], [46.9446, -15.1991], [46.6311, -15.4111], [46.7057, -15.3814], [46.7491, -15.4607],
  [46.6733, -15.4752], [46.6635, -15.4079], [46.4827, -15.526], [46.4961, -15.5854], [46.463, -15.5179], [46.4515, -15.6189], [46.4229, -15.562], [46.3696, -15.6074],
  [46.2987, -15.7163], [46.4039, -15.7442], [46.3235, -15.8042], [46.2126, -15.8532], [46.2322, -15.7176], [46.1214, -15.7121], [46.0031, -15.8162], [46.1299, -15.7765],
  [46.13, -15.8406], [46.0448, -15.8371], [46.111, -15.8682], [46.0747, -15.9029], [45.9483, -15.8682], [45.9317, -15.7813], [45.8906, -15.8739], [45.7854, -15.8583],
  [45.7928, -15.915], [45.7035, -15.7983], [45.7652, -15.7976], [45.6696, -15.7737], [45.5998, -16.0107], [45.664, -16.0963], [45.591, -16.0823], [45.4753, -16.0782],
  [45.5748, -16.0092], [45.5352, -15.9629], [45.3523, -15.9845], [45.3833, -16.0377], [45.4421, -15.9948], [45.3081, -16.1723], [45.2436, -16.1482], [45.2675, -15.9366],
  [45.2095, -15.9511], [45.1504, -16.0724], [45.1371, -15.9999], [44.9706, -16.164], [45.025, -16.2121], [44.894, -16.2021], [44.9081, -16.273], [44.8086, -16.3049],
  [44.7956, -16.379], [44.7905, -16.2591], [44.5075, -16.1842], [44.557, -16.2264], [44.5151, -16.3188], [44.452, -16.1924], [44.4242, -16.7173], [43.9353, -17.4627],
  [43.9592, -17.7378], [44.0304, -17.7847], [44.0125, -17.8964], [44.0689, -17.8912], [44.0107, -18.0187], [44.1106, -18.2533], [44.0544, -18.3048], [44.0374, -18.2187],
  [44.1069, -18.4493], [44.0571, -18.4354], [44.1694, -18.5142], [44.1573, -18.5997], [44.2646, -18.7302], [44.2116, -18.7027], [44.2336, -18.9199], [44.2897, -19.1267],
  [44.3812, -19.1515], [44.3123, -19.1659], [44.3467, -19.2863], [44.4573, -19.3266], [44.4653, -19.4353], [44.4086, -19.3489], [44.4895, -19.5753], [44.3889, -19.7942],
  [44.5248, -19.9722], [44.4034, -20.163], [44.3733, -20.1196], [44.2454, -20.4124], [44.1058, -20.5619], [44.1139, -20.4857], [44.0638, -20.7213], [43.9962, -20.7337],
  [44.0463, -20.7598], [43.9031, -20.8468], [43.7502, -21.3401], [43.5872, -21.3179], [43.5024, -21.3867], [43.5081, -21.6895], [43.4314, -21.6522], [43.3481, -21.7502],
  [43.3355, -21.9568], [43.2658, -22.0035], [43.2589, -21.9563], [43.2335, -22.0747], [43.3109, -22.2513], [43.2371, -22.2232], [43.228, -22.3261], [43.3708, -22.8453],
  [43.5939, -23.069], [43.6318, -23.3502], [43.7663, -23.4604], [43.7716, -23.5778], [43.6358, -23.6705], [43.683, -24.3739], [43.9348, -24.6356], [44.0395, -25.0131],
  [44.3155, -25.1703], [44.3478, -25.2642], [44.8066, -25.3406], [45.161, -25.6052], [45.4803, -25.5788], [46.2262, -25.2176], [46.7216, -25.179], [47.0994, -24.9937],
  [47.5921, -23.7881], [47.9068, -22.431], [48.8234, -19.912], [49.0039, -19.2115], [49.4299, -18.1607], [49.5201, -17.6921], [49.4317, -17.2807], [49.5996, -16.9043],
  [49.8385, -16.8383], [49.7213, -16.7141], [49.8401, -16.5607], [49.8584, -16.2228], [49.675, -16.0455], [49.731, -15.907], [49.6159, -15.5531], [49.7111, -15.4487],
  [49.8985, -15.4388], [50.0166, -15.8724], [50.2216, -15.9884], [50.3391, -15.8169], [50.4831, -15.3325], [50.2255, -14.7664], [50.1397, -13.796], [49.9197, -13.2002],
  [49.931, -13.0451], [49.7509, -12.7671], [49.6949, -12.7418], [49.6427, -12.8364], [49.6329, -12.6949], [49.5354, -12.6791], [49.5212, -12.4333], [49.4532, -12.4465],
  [49.5371, -12.4228], [49.5142, -12.3577], [49.4404, -12.3834], [49.3571, -12.2295], [49.342, -12.3115], [49.289, -12.2669], [49.1906, -12.3185], [49.2083, -12.2534],
  [49.2834, -12.2587], [49.2037, -12.2413], [49.2554, -12.1428], [49.3687, -12.2113], [49.2487, -11.9526],
];

/**
 * Marge de tolérance (degrés) autour du contour — absorbe à la fois la
 * simplification du polygone (~5 km) et l'imprécision GPS ordinaire, pour ne
 * jamais rejeter à tort un point réellement sur la côte ou sur une petite île
 * proche (Nosy Be, Sainte-Marie…). Volontairement resserrée : une position en
 * pleine mer, à plusieurs dizaines de km au large, reste rejetée.
 */
const MARGE_TOLERANCE_DEGRES = 0.15;

/** Point dans un polygone par lancer de rayon (ray casting) — algorithme
 * standard, insensible au sens de parcours du polygone. */
function pointDansPolygone(latitude: number, longitude: number, polygone: readonly [number, number][]): boolean {
  let dedans = false;
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const [xi, yi] = polygone[i];
    const [xj, yj] = polygone[j];
    const intersecte =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersecte) dedans = !dedans;
  }
  return dedans;
}

/** Distance (au carré, en « degrés équivalents ») d'un point à un segment —
 * la longitude est ramenée à une échelle comparable à la latitude via
 * cos(latitude), sinon un degré de longitude vaudrait artificiellement plus
 * near l'équateur que near les pôles. */
function distanceCarreePointSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const longueurCarree = dx * dx + dy * dy;
  const t = longueurCarree === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / longueurCarree));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return (px - projX) ** 2 + (py - projY) ** 2;
}

/** Distance (en degrés équivalents) du point au contour du polygone le plus proche. */
function distanceAuPolygone(latitude: number, longitude: number, polygone: readonly [number, number][]): number {
  const echelleLon = Math.cos((latitude * Math.PI) / 180);
  const px = longitude * echelleLon;
  const py = latitude;
  let minCarre = Infinity;
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const [xi, yi] = polygone[i];
    const [xj, yj] = polygone[j];
    const carre = distanceCarreePointSegment(px, py, xi * echelleLon, yi, xj * echelleLon, yj);
    if (carre < minCarre) minCarre = carre;
  }
  return Math.sqrt(minCarre);
}

/**
 * Vrai si la position est à Madagascar (île continentale) ou dans sa marge de
 * tolérance immédiate — faux pour toute position clairement hors de l'île, y
 * compris en pleine mer.
 */
export function estDansMadagascar(latitude: number, longitude: number): boolean {
  if (pointDansPolygone(latitude, longitude, MADAGASCAR_POLYGON)) return true;
  return distanceAuPolygone(latitude, longitude, MADAGASCAR_POLYGON) <= MARGE_TOLERANCE_DEGRES;
}
