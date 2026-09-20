import type { OrgType } from "./types";

/**
 * How each kind of institution talks about itself.
 *
 * A PG does not have students, it has residents. A hostel does not have
 * buildings, it has blocks. Using one generic vocabulary everywhere is
 * the fastest way to make a product feel like it was built for somebody
 * else — so every user-facing noun that varies by institution type is
 * defined here once, and screens read it from `vocabularyFor()` rather
 * than hard-coding a word.
 *
 * This is presentation only. The database stores the same `OrgType`,
 * `LocationType` and `UserRole` values regardless — a "resident" is still
 * a `reporter` row, and a PG's "building" is still a `building` location.
 * Wording and data model are deliberately kept apart so renaming a label
 * never means a migration.
 */
export interface Vocabulary {
  /** The institution itself: "College", "PG". */
  org: string;
  /** Field label when asking for its name. */
  orgNameLabel: string;
  orgNamePlaceholder: string;

  /** The top-level division of the property. */
  unit: string;
  unitPlural: string;
  /** Asking how many there are. */
  unitCountLabel: string;
  /** Real examples, so the owner knows what we mean. */
  unitExamples: string;
  unitPlaceholder: (index: number) => string;

  /**
   * Whether to ask how many floors each unit has.
   *
   * True only where residents genuinely describe their location that way
   * — in a hostel or PG, "2nd floor bathroom" is the natural way to say
   * where something is. A college has floors too, but its people say
   * "Science Block" far more often than "floor 3", so asking would be
   * five extra questions for something they will rarely pick.
   */
  asksFloors: boolean;

  /** The people who report problems. */
  reporter: string;
  reporterPlural: string;
  /** The people who fix them. */
  staff: string;
  staffPlural: string;
}

const VOCABULARIES: Record<OrgType, Vocabulary> = {
  school: {
    org: "School",
    orgNameLabel: "School name",
    orgNamePlaceholder: "Green Valley High School",
    unit: "Block",
    unitPlural: "Blocks",
    unitCountLabel: "How many blocks does your school have?",
    unitExamples: "Main Building, Science Block, Admin Block",
    unitPlaceholder: (i) => ["Main Building", "Science Block", "Admin Block"][i] ?? `Block ${i + 1}`,
    asksFloors: false,
    reporter: "Student",
    reporterPlural: "Students",
    staff: "Staff member",
    staffPlural: "Staff",
  },
  college: {
    org: "College",
    orgNameLabel: "College name",
    orgNamePlaceholder: "Green Valley College",
    unit: "Block",
    unitPlural: "Blocks",
    unitCountLabel: "How many blocks does your college have?",
    unitExamples: "Main Building, Library Block, Hostel Block",
    unitPlaceholder: (i) => ["Main Building", "Library Block", "Hostel Block"][i] ?? `Block ${i + 1}`,
    asksFloors: false,
    reporter: "Student",
    reporterPlural: "Students",
    staff: "Staff member",
    staffPlural: "Staff",
  },
  university: {
    org: "University",
    orgNameLabel: "University name",
    orgNamePlaceholder: "Green Valley University",
    unit: "Block",
    unitPlural: "Blocks",
    unitCountLabel: "How many blocks does your university have?",
    unitExamples: "Academic Block, Central Library, Hostel Block A",
    unitPlaceholder: (i) =>
      ["Academic Block", "Central Library", "Hostel Block A"][i] ?? `Block ${i + 1}`,
    asksFloors: false,
    reporter: "Student",
    reporterPlural: "Students",
    staff: "Staff member",
    staffPlural: "Staff",
  },
  hostel: {
    org: "Hostel",
    orgNameLabel: "Hostel name",
    orgNamePlaceholder: "Sunrise Boys Hostel",
    unit: "Block",
    unitPlural: "Blocks",
    unitCountLabel: "How many blocks does your hostel have?",
    unitExamples: "Block A, Block B, Mess Block",
    unitPlaceholder: (i) => ["Block A", "Block B", "Mess Block"][i] ?? `Block ${i + 1}`,
    asksFloors: true,
    reporter: "Resident",
    reporterPlural: "Residents",
    staff: "Warden or staff member",
    staffPlural: "Wardens & staff",
  },
  pg: {
    org: "PG",
    orgNameLabel: "PG name",
    orgNamePlaceholder: "Comfort Stay PG",
    unit: "Building",
    unitPlural: "Buildings",
    unitCountLabel: "How many buildings does your PG have?",
    unitExamples: "Main Building, Annexe",
    unitPlaceholder: (i) => ["Main Building", "Annexe"][i] ?? `Building ${i + 1}`,
    asksFloors: true,
    reporter: "Resident",
    reporterPlural: "Residents",
    staff: "Caretaker or staff member",
    staffPlural: "Caretakers & staff",
  },
};

export function vocabularyFor(orgType: OrgType): Vocabulary {
  return VOCABULARIES[orgType];
}

/** The institution types offered on the first step of onboarding, in the
 * order they appear, each with the one line that tells an owner whether
 * it is them. */
export const ORG_TYPE_CHOICES: {
  value: OrgType;
  label: string;
  blurb: string;
}[] = [
  { value: "university", label: "University", blurb: "Multiple faculties, campuses or hostels" },
  { value: "college", label: "College", blurb: "A single campus with blocks and departments" },
  { value: "school", label: "School", blurb: "Classrooms, labs and shared facilities" },
  { value: "hostel", label: "Hostel", blurb: "Residential blocks, rooms, mess and common areas" },
  { value: "pg", label: "PG / Co-living", blurb: "Paying guest accommodation or co-living space" },
];
