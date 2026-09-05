import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { RoleUtilisateurEquipe, UtilisateurEquipe } from '@/lib/referentiel-db';
import { Chip } from '@/components/traitement/Chip';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

type RoleCreableALaVolee = Extract<RoleUtilisateurEquipe, 'pilote' | 'mecanicien' | 'consultant_international'>;

interface UtilisateurSelectFieldProps {
  utilisateurs: UtilisateurEquipe[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  onUtilisateursChange?: (utilisateurs: UtilisateurEquipe[]) => void;
  readOnly: boolean;
  role?: RoleCreableALaVolee;
  facultatif?: boolean;
}

/** Sélectionne un utilisateur du référentiel et, pour les rôles autorisés,
 * permet de créer son identité en ligne sans proposer cette action au chef de base. */
export function UtilisateurSelectField({
  utilisateurs,
  selectedId,
  onSelect,
  onUtilisateursChange,
  readOnly,
  role,
  facultatif = false,
}: UtilisateurSelectFieldProps) {
  const token = useAuthStore((state) => state.token);
  const [creationVisible, setCreationVisible] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const creer = async () => {
    const prenomNettoye = prenom.trim();
    const nomNettoye = nom.trim();
    if (!prenomNettoye || !nomNettoye) {
      setCreationError('Le prénom et le nom sont obligatoires.');
      return;
    }
    if (!token || !role || !onUtilisateursChange) {
      setCreationError('Création indisponible hors connexion ou sans session active.');
      return;
    }

    setIsCreating(true);
    setCreationError(null);
    try {
      const cree = await apiClient.createUserALaVolee(token, {
        prenom: prenomNettoye,
        nom: nomNettoye,
        role,
      });
      const utilisateur = { id: cree.id, prenom: cree.prenom, nom: cree.nom };
      onUtilisateursChange([...utilisateurs, utilisateur].sort((a, b) => a.nom.localeCompare(b.nom)));
      onSelect(utilisateur.id);
      setPrenom('');
      setNom('');
      setCreationVisible(false);
    } catch (error) {
      setCreationError(error instanceof Error ? error.message : 'Impossible de créer cet utilisateur.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View>
      <View style={styles.chipRow}>
        {facultatif && (
          <Chip label="Aucun" selected={!selectedId} onPress={() => !readOnly && onSelect(null)} />
        )}
        {utilisateurs.map((utilisateur) => (
          <Chip
            key={utilisateur.id}
            label={`${utilisateur.prenom} ${utilisateur.nom}`}
            selected={selectedId === utilisateur.id}
            onPress={() => !readOnly && onSelect(utilisateur.id)}
          />
        ))}
      </View>

      {role && !readOnly && (
        <View>
          <TouchableOpacity style={styles.addButton} onPress={() => setCreationVisible((visible) => !visible)}>
            <Text style={styles.addButtonText}>{creationVisible ? 'Annuler' : '+ Créer un utilisateur'}</Text>
          </TouchableOpacity>
          {creationVisible && (
            <View>
              <TextInput value={prenom} onChangeText={setPrenom} style={styles.input} placeholder="Prénom" />
              <TextInput value={nom} onChangeText={setNom} style={styles.input} placeholder="Nom" />
              {creationError && <Text style={styles.error}>{creationError}</Text>}
              <TouchableOpacity style={styles.addButton} onPress={creer} disabled={isCreating}>
                <Text style={styles.addButtonText}>{isCreating ? 'Création…' : 'Créer et sélectionner'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
