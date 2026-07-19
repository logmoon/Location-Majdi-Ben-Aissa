// Translations.ts - Contains all French translations for the app

export const Translations = {
  // General
  appName: 'Location Majdi Ben Aissa',
  loading: 'Chargement...',
  error: 'Erreur',
  success: 'Succès',
  cancel: 'Annuler',
  save: 'Enregistrer',
  delete: 'Supprimer',
  confirm: 'Confirmer',
  back: 'Retour',
  next: 'Suivant',
  done: 'Terminé',
  
  // Authentication
  login: 'Connexion',
  logout: 'Déconnexion',
  adminMode: 'Mode Administrateur',
  viewerMode: 'Mode Visiteur',
  enterPassword: 'Entrez le mot de passe',
  incorrectPassword: 'Mot de passe incorrect',
  
  // Navigation
  houses: 'Maisons',
  calendar: 'Calendrier',
  settings: 'Paramètres',
  
  // Houses
  selectHouse: 'Sélectionnez une maison',
  houseDetails: 'Détails de la maison',
  searchForAvailability: 'Rechercher Disponibilité',
  search: 'Rechercher',
  
  // Calendar
  available: 'Disponible',
  rented: 'Loué',
  availableLegend: 'Disponible',
  rentedLegend: 'Loué',
  halfDayLegend: 'Demi-journée',
  selectDates: 'Sélectionnez les dates',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  renterName: 'Nom du locataire',
  notes: 'Notes',
  addRental: 'Ajouter une location',
  removeRental: 'Supprimer la location',
  rentalAdded: 'Location ajoutée avec succès',
  rentalRemoved: 'Location supprimée avec succès',
  editRental: 'Modifier la location',
  rentalDetails: 'Détails de la location',
  halfDayBooking: 'Réservation demi-journée',
  startHalfDay: 'Arrivée à midi',
  endHalfDay: 'Départ à midi',
  morningOnly: 'Matin seulement',
  afternoonOnly: 'Après-midi seulement',
  fullDay: 'Journée complète',
  
  // Settings
  language: 'Langue',
  about: 'À propos',
  help: 'Aide',
  adminAccess: 'Accès administrateur',
  sync: 'Synchroniser',
  syncing: 'Synchronisation...',
  syncSuccess: 'Synchronisation réussie',
  syncError: 'Erreur de synchronisation',
  clearData: 'Effacer les données',
  clearDataConfirm: 'Êtes-vous sûr de vouloir effacer toutes les données locales?',
  // Shown instead of clearDataConfirm when there are unsynced local changes —
  // makes explicit that this specific action permanently destroys exactly
  // the changes that haven't made it to the server yet, since a stuck sync
  // is exactly the situation that tempts someone to reach for "clear data"
  // as a fix, right when doing so would be most destructive.
  clearDataConfirmWithPending: (count: number) =>
    `Attention : ${count} modification${count > 1 ? 's' : ''} locale${count > 1 ? 's' : ''} n'${count > 1 ? 'ont' : 'a'} pas encore été synchronisée${count > 1 ? 's' : ''} avec le serveur.\n\nEffacer les données locales supprimera définitivement ${count > 1 ? 'ces modifications' : 'cette modification'}. Cette action est irréversible.\n\nVoulez-vous vraiment continuer ?`,
  clearSuccess: 'Données effacées avec succès',
  clearError: 'Erreur lors de l\'effacement des données',
  dataManagement: 'Gestion des données',
  syncData: 'Synchroniser',
  offlineNoSync: 'Synchronisation impossible en mode hors ligne',
  lastSync: 'Dernière synchronisation',
  
  // Network
  offlineWarning: 'Vous êtes hors ligne. Les données affichées peuvent ne pas être à jour.',
  lastConnected: 'Dernière connexion',
  syncingData: 'Synchronisation des données...',
  syncingComplete: 'Synchronisation terminée',
  retryConnection: 'Vérifier la connexion',
  connectionRestored: 'Connexion rétablie',
  
  // Months
  months: [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ],
  
  // Days of week
  daysOfWeek: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
};

// Add default export to fix warning
export default Translations;