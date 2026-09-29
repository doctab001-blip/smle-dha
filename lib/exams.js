// Exam funnels. `mockFormat` must match a row in public.mock_formats.
export const EXAMS = {
  smle: {
    code: 'smle',
    short: 'SMLE',
    a: 'an', // article: "an SMLE"
    name: 'Saudi Medical Licensing Exam',
    authority: 'Saudi Commission for Health Specialties (SCFHS)',
    country: 'Saudi Arabia',
    mockFormat: 'smle_200',
    mockQuestions: 200,
    tagline: 'Practise for Saudi GP registration with questions set in Saudi clinical practice.',
    regional: [
      'Sickle cell disease and thalassaemia in the Eastern Province',
      'MERS-CoV triage and infection control',
      'Hajj and Umrah: heat illness and meningococcal disease',
      'Diabetes and medication adjustment during Ramadan',
      'Consanguinity, premarital screening and genetic counselling',
      'Islamic medical ethics and SCFHS professionalism',
    ],
  },
  dha: {
    code: 'dha',
    short: 'DHA',
    a: 'a', // "a DHA"
    name: 'Dubai Health Authority licensing exam',
    authority: 'Dubai Health Authority (DHA)',
    country: 'United Arab Emirates',
    mockFormat: 'dha_150',
    mockQuestions: 150,
    tagline: 'Prepare for your Dubai licence with exam-style questions and UAE-relevant cases.',
    regional: [
      'Heat illness and dehydration in outdoor workers',
      'Diabetes, obesity and cardiovascular risk in the UAE population',
      'G6PD deficiency and haemoglobinopathies',
      'Travel and mass-gathering medicine',
      'Ramadan fasting and chronic disease',
      'Medical ethics, consent and professional conduct',
    ],
  },
};

export const EXAM_CODES = Object.keys(EXAMS);
export const isExam = (v) => EXAM_CODES.includes(v);
