import { z } from 'zod'

const captureSchema = z.object({
  id: z.number(),
  espece: z.string(),
  categorie: z.string(),
  stade: z.string(),
  sexe: z.string(),
  phase: z.string(),
  effectif: z.string(),
})

export const prospectionFormSchema = z.object({
  campagne_id: z.string().min(1, { error: 'La campagne est obligatoire.' }),
  date_prospection: z.string().min(1, { error: 'La date est obligatoire.' }),
  station_id: z.string().min(1, { error: 'La station fixe est obligatoire pour une prospection intensive.' }),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  altitude: z.string().optional(),
  surface_station: z.string().optional(),
  surface_prospectee: z.string().optional(),
  surface_infestee: z.string().optional(),
  captures: z.array(captureSchema),
})

export type ProspectionFormValues = z.infer<typeof prospectionFormSchema>

interface CampagneRange {
  id: string
  start_date: string
  end_date: string | null
}

export function validateProspectionCrossFields(
  data: ProspectionFormValues,
  campagnes: CampagneRange[],
): Record<string, string> {
  const errs: Record<string, string> = {}

  if (data.campagne_id && data.date_prospection) {
    const campagne = campagnes.find((c) => c.id === data.campagne_id)
    if (campagne) {
      if (data.date_prospection < campagne.start_date) {
        errs.date_prospection = `La date est antérieure au début de la campagne (${campagne.start_date}).`
      } else if (campagne.end_date && data.date_prospection > campagne.end_date) {
        errs.date_prospection = `La date est postérieure à la fin de la campagne (${campagne.end_date}).`
      }
    }
  }

  if (data.latitude) {
    const lat = parseFloat(data.latitude)
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errs.latitude = 'La latitude doit être comprise entre -90 et 90.'
    }
  }

  if (data.longitude) {
    const lon = parseFloat(data.longitude)
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errs.longitude = 'La longitude doit être comprise entre -180 et 180.'
    }
  }

  if (data.altitude) {
    const alt = parseFloat(data.altitude)
    if (isNaN(alt) || alt < 0) {
      errs.altitude = "L'altitude doit être un nombre positif."
    }
  }

  const surfaceStation = data.surface_station ? parseFloat(data.surface_station) : null
  const surfaceProspectee = data.surface_prospectee ? parseFloat(data.surface_prospectee) : null
  const surfaceInfestee = data.surface_infestee ? parseFloat(data.surface_infestee) : null

  if (surfaceProspectee !== null && surfaceStation !== null && surfaceProspectee > surfaceStation) {
    errs.surface_prospectee = 'La surface prospectée ne peut pas dépasser la surface de la station.'
  }
  if (surfaceInfestee !== null && surfaceProspectee !== null && surfaceInfestee > surfaceProspectee) {
    errs.surface_infestee = 'La surface infestée ne peut pas dépasser la surface prospectée.'
  }

  const hasCapture = data.captures.some((c) => parseInt(c.effectif, 10) > 0)
  if (!hasCapture) {
    errs.captures = 'Au moins une capture avec un effectif supérieur à 0 est requise.'
  }

  return errs
}
