export const UNIVERSITY_DOMAIN_PROFILES = [
  { domain: "bilkent.edu.tr", name: "Bilkent University" },
  { domain: "metu.edu.tr", name: "Middle East Technical University" },
  { domain: "hacettepe.edu.tr", name: "Hacettepe University" },
  { domain: "ku.edu.tr", name: "Koc University" },
  { domain: "sabanciuniv.edu", name: "Sabanci University" },
  { domain: "boun.edu.tr", name: "Bogazici University" },
  { domain: "itu.edu.tr", name: "Istanbul Technical University" },
  { domain: "ada.edu.az", name: "ADA University" },
  { domain: "bsu.edu.az", name: "Baku State University" },
  { domain: "asoiu.edu.az", name: "Azerbaijan State Oil and Industry University" }
];

export const VALID_UNIVERSITY_DOMAINS = UNIVERSITY_DOMAIN_PROFILES.map((profile) => profile.domain);

export function getEmailDomain(email: string) {
  if (!email || !email.includes("@")) return "";
  return email.split("@").pop()?.trim().toLowerCase() || "";
}

export function getUniversityProfileForEmail(email: string) {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  return UNIVERSITY_DOMAIN_PROFILES.find((profile) => {
    return domain === profile.domain || domain.endsWith(`.${profile.domain}`);
  }) || null;
}

export function isValidUniversityDomain(email: string): boolean {
  return Boolean(getUniversityProfileForEmail(email));
}
