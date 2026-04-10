/**
 * Liste exhaustive des communes, quartiers et zones du Grand Abidjan
 * Utilisé pour déterminer si un client est éligible au paiement à la livraison
 */

const ABIDJAN_ZONES: string[] = [
  // Communes officielles d'Abidjan
  "abidjan",
  "abobo",
  "adjamé",
  "adjame",
  "anyama",
  "attécoubé",
  "attecoube",
  "attiecoube",
  "bingerville",
  "cocody",
  "koumassi",
  "marcory",
  "plateau",
  "port-bouët",
  "port-bouet",
  "port bouët",
  "port bouet",
  "treichville",
  "yopougon",
  "songon",
  "gonzagueville",

  // Sous-quartiers / zones très connus de Cocody
  "riviera",
  "riviera 1",
  "riviera 2",
  "riviera 3",
  "riviera 4",
  "riviera palmeraie",
  "riviera faya",
  "riviera bonoumin",
  "angré",
  "angre",
  "deux plateaux",
  "2 plateaux",
  "val doyen",
  "danga",
  "ambassade",
  "blockauss",
  "attoban",
  "akouédo",
  "akouedo",
  "ancien camp d'akouédo",
  "ancien camp d'akouedo",
  "feh kessé",
  "feh kesse",
  "saint jean",
  "st jean",
  "palmeraie",
  "bonoumin",
  "lycée technique",
  "lycee technique",
  "mermoz",
  "8ème tranche",
  "8eme tranche",
  "9ème tranche",
  "9eme tranche",
  "cocody danga",

  // Sous-quartiers / zones de Yopougon
  "yopougon",
  "yop",
  "niangon",
  "niangon nord",
  "niangon sud",
  "wassakara",
  "andokoi",
  "banco",
  "azito",
  "gesco",
  "selmer",
  "ananeraie",
  "toits rouges",
  "port-bouët 2",
  "port bouet 2",
  "maroc",
  "sicogi",
  "sideci",
  "millionnaire",
  "toit rouge",
  "nassian",
  "koweït",
  "koweit",
  "lubafrique",
  "académie",
  "academie",
  "ficgayo",
  "micao",
  "siporex",
  "lokoa",
  "sopim",
  "lievre",
  "lièvre",
  "mamie faitai",

  // Sous-quartiers / zones d'Abobo
  "abobo gare",
  "abobo baoulé",
  "abobo baoule",
  "abobo pk18",
  "pk18",
  "abobo avocatier",
  "avocatier",
  "abobo doumé",
  "abobo doume",
  "abobo sagbé",
  "abobo sagbe",
  "abobo n'dotré",
  "abobo n'dotre",
  "abobo kennedy",
  "abobo plaque",
  "abobo ste anne",
  "sainte anne",
  "anador",
  "habitat abobo",
  "sogefiha",

  // Sous-quartiers / zones de Marcory
  "zone 4",
  "zone4",
  "biétry",
  "bietry",
  "anoumabo",
  "remblais",
  "nouveau marcory",

  // Sous-quartiers / zones de Koumassi
  "koumassi campement",
  "koumassi remblais",
  "grand campement",
  "prodomo",

  // Sous-quartiers / zones de Treichville
  "treichville",
  "avenue 17",

  // Sous-quartiers / zones de Port-Bouët
  "vridi",
  "vridi canal",
  "vridi cité",
  "vridi cite",
  "vridi 3",
  "gonzagueville",
  "petit bassam",

  // Sous-quartiers / zones du Plateau
  "le plateau",
  "plateau dokui",
  "plateau indénié",
  "plateau indenie",

  // Sous-quartiers / zones d'Adjamé
  "williamsville",
  "bracodi",
  "fraternité",
  "fraternite",
  "220 logements",
  "liberté",
  "liberte",
  "habitat adjamé",
  "habitat adjame",

  // Sous-quartiers / zones d'Anyama
  "anyama mairie",
  "anyama gare",
  "anyama adjamé",

  // Zones périphériques du Grand Abidjan
  "bingerville",
  "songon",
  "dabou",
  "grand-bassam",
  "grand bassam",
  "bassam",
  "jacqueville",
  "alépé",
  "alepe",
  "bonoua",
  "assinie",

  // Zones industrielles / commerciales
  "zone industrielle",
  "zone industrielle de yopougon",
  "zone industrielle de vridi",
  "zone franche",
  "pk24",
  "pk 24",

  // Piétrie / Djrobité / Sinassakass mentionnés par l'utilisateur
  "piétrie",
  "pietrie",
  "djrobité",
  "djrobite",
  "djrobité 1",
  "djrobite 1",
  "djrobité 2",
  "djrobite 2",
  "sinassakass",
  "houméssi",
  "houmessi",
];

/**
 * Vérifie si une ville/quartier fait partie de la zone du Grand Abidjan
 * La recherche est insensible à la casse et vérifie si le texte saisi
 * contient ou est contenu dans l'une des zones connues
 */
export function isAbidjanZone(city: string): boolean {
  if (!city || !city.trim()) return false;
  
  const normalizedCity = city
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[-']/g, " ");          // Normalize separators

  // Check if the input matches or contains any known Abidjan zone
  return ABIDJAN_ZONES.some((zone) => {
    const normalizedZone = zone
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-']/g, " ");
    return normalizedCity.includes(normalizedZone) || normalizedZone.includes(normalizedCity);
  });
}
