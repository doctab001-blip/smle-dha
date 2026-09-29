export const SITE_NAME = 'GulfMed QBank';

export const SUBJECTS = [
  { slug: 'internal-medicine', name: 'Internal Medicine', short: 'Medicine' },
  { slug: 'general-surgery', name: 'General Surgery', short: 'Surgery' },
  { slug: 'pediatrics', name: 'Pediatrics', short: 'Pediatrics' },
  { slug: 'obgyn', name: 'Obstetrics & Gynecology', short: 'OBGYN' },
  { slug: 'preventive-ethics', name: 'Preventive Medicine & Ethics', short: 'Prev. & Ethics' },
  { slug: 'psychiatry', name: 'Psychiatry', short: 'Psychiatry' },
];

export const subjectName = (slug) => SUBJECTS.find((s) => s.slug === slug)?.name ?? slug;

// Column list for question stems — correct_answer / explanation are not readable by design.
export const QUESTION_COLUMNS =
  'id, subject_category, topic_id, note_id, text, lead_in, lab_values, media, options, exam_targets, difficulty';

export const EXAM_LABELS = { smle: 'SMLE', dha: 'DHA', doh: 'DOH', mohap: 'MOHAP' };
