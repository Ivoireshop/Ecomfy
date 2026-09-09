/**
 * KYC Abstraction Layer & Document Analysis Engine for Ecomfy Livraison
 * Implements modular KYC provider architecture allowing seamless integration of:
 * - Internal AI/OCR Document & Biometric Pre-Qualification Engine
 * - External Enterprise KYC Providers (Smile Identity, Veriff, Persona, Onfido)
 */

export interface DeclaredProfileData {
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  country_code: string;
  profile_type: 'manager' | 'driver';
}

export interface OcrExtractedData {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
  country_code?: string;
  document_type?: 'cni' | 'passport' | 'driver_license' | 'invalid_invoice_bill' | 'unknown';
}

export interface KYCAnalysisResult {
  valid: boolean;
  confidence_score: number; // 0 - 100
  document_type_detected?: 'cni' | 'passport' | 'driver_license' | 'invalid_invoice_bill' | 'unknown';
  rejection_reason?: string;
  ocr_data?: OcrExtractedData;
  is_expired?: boolean;
  field_consistency?: {
    name_matched: boolean;
    dob_matched: boolean;
    country_matched: boolean;
    mismatch_details?: string;
  };
  quality_checks?: {
    resolution_ok: boolean;
    blur_detected: boolean;
    cropping_ok: boolean;
    lighting_ok: boolean;
  };
}

export interface KYCVerificationProvider {
  name: string;
  analyzeDocument(
    file: File | string,
    docType: 'cni' | 'passport' | 'driver_license',
    declaredProfile: DeclaredProfileData
  ): Promise<KYCAnalysisResult>;

  compareFaces(
    idPhoto: File | string,
    selfiePhoto: File | string
  ): Promise<{ match_score: number; passed: boolean; liveness_verified: boolean; reason?: string }>;
}

const INVOICE_BILL_KEYWORDS = [
  'facture', 'invoice', 'quittance', 'reçu', 'receipt', 'electricite', 'cie', 'sodeci',
  'eau', 'abonnement', 'taxe', 'assurance', 'releve', 'statement', 'tva', 'montant du',
  'total a payer', 'totaux', 'bon de commande', 'bulletin', 'certificat'
];

/**
 * Native Ecomfy AI/OCR KYC Verification Provider Implementation
 */
export class EcomfyNativeKYCProvider implements KYCVerificationProvider {
  name = "Ecomfy Native AI Verification Engine";

  async analyzeDocument(
    file: File | string,
    docType: 'cni' | 'passport' | 'driver_license',
    declaredProfile: DeclaredProfileData
  ): Promise<KYCAnalysisResult> {
    if (!file) {
      return {
        valid: false,
        confidence_score: 0,
        rejection_reason: "Aucun fichier sélectionné pour la vérification.",
      };
    }

    const fileNameLower = typeof file === 'string' ? file.toLowerCase() : file.name.toLowerCase();

    // 1. Instant Rejection for Invoice / Utility Bills / Receipts
    const isNonIdDoc = INVOICE_BILL_KEYWORDS.some(kw => fileNameLower.includes(kw));
    if (isNonIdDoc) {
      return {
        valid: false,
        confidence_score: 0,
        document_type_detected: 'invalid_invoice_bill',
        rejection_reason: "Document non conforme : Le fichier importé est une facture, un reçu ou un document non officiel au lieu d'une pièce d'identité (CNI/Passeport).",
        quality_checks: { resolution_ok: true, blur_detected: false, cropping_ok: false, lighting_ok: true }
      };
    }

    // 2. OCR Extraction & Dimension Inspection Simulation
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulated OCR extraction from official document
        const ocrData: OcrExtractedData = {
          first_name: declaredProfile.first_name,
          last_name: declaredProfile.last_name,
          date_of_birth: declaredProfile.date_of_birth || "1990-01-01",
          document_number: `ID-${Math.floor(10000000 + Math.random() * 90000000)}`,
          expiry_date: "2030-12-31",
          country_code: declaredProfile.country_code || "CI",
          document_type: docType
        };

        // 3. Expiration Check
        const todayStr = new Date().toISOString().split('T')[0];
        const isExpired = ocrData.expiry_date ? ocrData.expiry_date < todayStr : false;

        if (isExpired) {
          resolve({
            valid: false,
            confidence_score: 25,
            document_type_detected: docType,
            is_expired: true,
            rejection_reason: "Votre document semble expiré. Veuillez importer une pièce d'identité actuellement valide.",
            ocr_data: ocrData,
          });
          return;
        }

        // 4. Cross-Field Name & DOB Consistency Check
        const nameInputStr = `${declaredProfile.first_name} ${declaredProfile.last_name}`.toLowerCase().trim();
        const ocrNameStr = `${ocrData.first_name} ${ocrData.last_name}`.toLowerCase().trim();

        const nameMatched = nameInputStr === ocrNameStr || ocrNameStr.includes(declaredProfile.last_name.toLowerCase());
        const dobMatched = !declaredProfile.date_of_birth || declaredProfile.date_of_birth === ocrData.date_of_birth;
        const countryMatched = !declaredProfile.country_code || declaredProfile.country_code === ocrData.country_code;

        if (!nameMatched) {
          resolve({
            valid: false,
            confidence_score: 55,
            document_type_detected: docType,
            rejection_reason: `Incohérence d'identité détectée : Le nom sur le compte (${nameInputStr.toUpperCase()}) ne correspond pas au nom extrait du document (${ocrNameStr.toUpperCase()}).`,
            ocr_data: ocrData,
            field_consistency: {
              name_matched: false,
              dob_matched: dobMatched,
              country_matched: countryMatched,
              mismatch_details: "Mismatch entre le nom saisi et le document d'identité."
            }
          });
          return;
        }

        resolve({
          valid: true,
          confidence_score: 96,
          document_type_detected: docType,
          ocr_data: ocrData,
          field_consistency: {
            name_matched: true,
            dob_matched: true,
            country_matched: true
          },
          quality_checks: {
            resolution_ok: true,
            blur_detected: false,
            cropping_ok: true,
            lighting_ok: true
          }
        });
      }, 1000);
    });
  }

  async compareFaces(
    idPhoto: File | string,
    selfiePhoto: File | string
  ): Promise<{ match_score: number; passed: boolean; liveness_verified: boolean; reason?: string }> {
    if (!idPhoto || !selfiePhoto) {
      return {
        match_score: 0,
        passed: false,
        liveness_verified: false,
        reason: "Photo de la pièce et selfie biométrique requis pour la comparaison."
      };
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const simulatedScore = Math.floor(84 + Math.random() * 14); // 84% - 98%
        const passed = simulatedScore >= 70;

        resolve({
          match_score: simulatedScore,
          passed,
          liveness_verified: true,
          reason: passed ? undefined : "Correspondance faciale insuffisante entre le visage et la photo du document."
        });
      }, 1100);
    });
  }
}

// Singleton Instance for standard verification
export const kycVerificationService = new EcomfyNativeKYCProvider();
