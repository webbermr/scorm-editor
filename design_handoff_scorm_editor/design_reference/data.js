// Sample SCORM course — "Cybersecurity Essentials"
// A realistic corporate compliance course exercising every content type:
// title, content (text + image), video, multiple-choice quiz, multi-question
// knowledge check, and a branching scenario.

window.makeId = () => 'id_' + Math.random().toString(36).slice(2, 9);

window.SAMPLE_COURSE = {
  meta: {
    title: 'Cybersecurity Essentials',
    package: 'cybersec_essentials_v3.zip',
    identifier: 'COURSE-SEC-101',
    scormVersion: '2004', // '1.2' | '2004'
    edition: 'SCORM 2004 4th Edition',
    language: 'English (US)',
    author: 'L&D — Security Awareness Team',
    duration: '~25 min',
    passingScore: 80,
    masteryRule: 'completed-passed', // see COMPLETION_RULES
    trackTime: true,
    allowReview: true,
    description:
      'A required annual awareness course covering phishing, password hygiene, and safe handling of company data.',
  },
  slides: [
    {
      id: 'sl_intro',
      type: 'title',
      name: 'Welcome',
      status: 'complete',
      duration: '1 min',
      blocks: [
        { id: 'b1', type: 'eyebrow', text: 'ANNUAL COMPLIANCE · 2026' },
        { id: 'b2', type: 'heading', text: 'Cybersecurity Essentials' },
        {
          id: 'b3',
          type: 'paragraph',
          text: 'Every employee is a line of defense. In the next 25 minutes you’ll learn to spot threats before they become incidents — and what to do when something looks off.',
        },
        {
          id: 'b4',
          type: 'image',
          src: 'shield',
          alt: 'Abstract security shield illustration',
          caption: 'Your awareness is the strongest firewall we have.',
        },
      ],
    },
    {
      id: 'sl_landscape',
      type: 'content',
      name: 'The Threat Landscape',
      status: 'complete',
      duration: '3 min',
      blocks: [
        { id: 'b1', type: 'heading', text: 'The Threat Landscape' },
        {
          id: 'b2',
          type: 'paragraph',
          text: 'Attackers rarely break in — they log in. The vast majority of breaches begin with a person, not a firewall. Understanding where attacks come from helps you stay one step ahead.',
        },
        {
          id: 'b3',
          type: 'list',
          items: [
            'Phishing emails impersonating colleagues or vendors',
            'Reused or weak passwords exposed in past breaches',
            'Unsecured devices left unlocked or unencrypted',
            'Sensitive data shared over unapproved channels',
          ],
        },
        {
          id: 'b4',
          type: 'callout',
          tone: 'info',
          title: 'Did you know?',
          text: 'Roughly 9 in 10 successful breaches start with a phishing email. The human layer matters most.',
        },
      ],
    },
    {
      id: 'sl_video',
      type: 'video',
      name: 'Anatomy of a Phish',
      status: 'in-progress',
      duration: '4 min',
      blocks: [
        { id: 'b1', type: 'heading', text: 'Anatomy of a Phish' },
        {
          id: 'b2',
          type: 'paragraph',
          text: 'Watch how a single convincing email can unravel into a full account takeover — and the small signals that give it away.',
        },
        {
          id: 'b3',
          type: 'video',
          poster: 'video',
          length: '3:42',
          title: 'How attackers craft the perfect lure',
          required: true,
        },
      ],
    },
    {
      id: 'sl_quiz1',
      type: 'quiz',
      name: 'Spot the Phish',
      status: 'not-started',
      duration: '2 min',
      quiz: {
        prompt: 'Spot the Phish',
        instruction: 'Select the single biggest red flag in the email below.',
        kind: 'single', // single | multiple
        shuffle: true,
        feedback: true,
        questions: [
          {
            id: 'q1',
            text: 'An email from “IT Helpdesk” asks you to “verify your password within 24 hours or your account will be suspended,” linking to id-verify-corp.net. What’s the biggest red flag?',
            options: [
              { id: 'o1', text: 'The friendly tone of the message', correct: false },
              { id: 'o2', text: 'A mismatched, urgent link to an external domain', correct: true },
              { id: 'o3', text: 'It was sent in the morning', correct: false },
              { id: 'o4', text: 'It mentions the IT department', correct: false },
            ],
            feedbackCorrect: 'Exactly — urgency plus an off-domain link is the classic phishing combo.',
            feedbackIncorrect: 'Look closer at the link destination and the pressure to act fast.',
          },
        ],
      },
    },
    {
      id: 'sl_passwords',
      type: 'content',
      name: 'Password Hygiene',
      status: 'not-started',
      duration: '3 min',
      blocks: [
        { id: 'b1', type: 'heading', text: 'Password Hygiene' },
        {
          id: 'b2',
          type: 'paragraph',
          text: 'Long beats complex. A passphrase of four random words is far harder to crack than “P@ssw0rd!” — and far easier to remember.',
        },
        {
          id: 'b3',
          type: 'image',
          src: 'lock',
          alt: 'Passphrase strength illustration',
          caption: 'correct-horse-battery-staple beats Tr0ub4dor every time.',
        },
        {
          id: 'b4',
          type: 'callout',
          tone: 'warning',
          title: 'Never reuse',
          text: 'One reused password can unlock every account that shares it. Use the company password manager.',
        },
      ],
    },
    {
      id: 'sl_branch',
      type: 'branching',
      name: 'Scenario: The Urgent Invoice',
      status: 'not-started',
      duration: '4 min',
      scenario: {
        setup:
          'It’s 4:55pm on a Friday. You receive an email from your CFO: “I’m in a meeting and need you to pay this overdue invoice urgently. Don’t call — just wire it.” What do you do?',
        choices: [
          {
            id: 'c1',
            text: 'Wire the payment immediately — it’s the CFO',
            outcome: 'incorrect',
            result: 'This is a textbook Business Email Compromise. Urgency + secrecy + money should always trigger verification.',
          },
          {
            id: 'c2',
            text: 'Verify through a known channel before acting',
            outcome: 'correct',
            result: 'Right call. A quick call or message on a trusted channel exposes the impersonation in seconds.',
          },
          {
            id: 'c3',
            text: 'Reply to the email asking for confirmation',
            outcome: 'partial',
            result: 'Risky — if the account is spoofed or compromised, you’re confirming with the attacker. Use an out-of-band channel.',
          },
        ],
      },
    },
    {
      id: 'sl_check',
      type: 'quiz',
      name: 'Knowledge Check',
      status: 'not-started',
      duration: '4 min',
      quiz: {
        prompt: 'Knowledge Check',
        instruction: 'Answer all questions. You need 80% to pass.',
        kind: 'multiple',
        shuffle: false,
        feedback: false,
        questions: [
          {
            id: 'q1',
            text: 'Which password is strongest?',
            options: [
              { id: 'o1', text: 'Summer2026!', correct: false },
              { id: 'o2', text: 'river-cactus-velvet-ladder', correct: true },
              { id: 'o3', text: 'P@ssw0rd', correct: false },
            ],
          },
          {
            id: 'q2',
            text: 'You get an unexpected attachment from a known vendor. You should…',
            options: [
              { id: 'o1', text: 'Open it to see what it is', correct: false },
              { id: 'o2', text: 'Verify via a known contact before opening', correct: true },
              { id: 'o3', text: 'Forward it to your team first', correct: false },
            ],
          },
          {
            id: 'q3',
            text: 'True or false: reusing one strong password everywhere is safe.',
            options: [
              { id: 'o1', text: 'True', correct: false },
              { id: 'o2', text: 'False', correct: true },
            ],
          },
        ],
      },
    },
    {
      id: 'sl_summary',
      type: 'content',
      name: 'You’re Done',
      status: 'not-started',
      duration: '1 min',
      blocks: [
        { id: 'b1', type: 'eyebrow', text: 'COURSE COMPLETE' },
        { id: 'b2', type: 'heading', text: 'Nice work — you’re a tougher target now.' },
        {
          id: 'b3',
          type: 'paragraph',
          text: 'Stay skeptical of urgency, verify through trusted channels, and report anything suspicious to security@company.com. Your completion has been recorded.',
        },
        {
          id: 'b4',
          type: 'list',
          items: [
            'Pause before you click',
            'Verify money & data requests out-of-band',
            'Use the password manager — never reuse',
            'Report, don’t delete, suspicious mail',
          ],
        },
      ],
    },
  ],
};

window.COMPLETION_RULES = [
  { id: 'completed-passed', label: 'Completed + Passed', desc: 'Learner must view all slides and pass the quiz.' },
  { id: 'passed', label: 'Passed only', desc: 'Completion is granted on reaching the passing score.' },
  { id: 'completed', label: 'Completed only', desc: 'Completion is granted on viewing all content.' },
  { id: 'visited', label: 'Visited', desc: 'Marked complete on first launch.' },
];

window.SLIDE_TYPES = [
  { id: 'content', label: 'Content', desc: 'Text, images & callouts' },
  { id: 'video', label: 'Video', desc: 'Embedded media clip' },
  { id: 'quiz', label: 'Quiz', desc: 'Graded questions' },
  { id: 'branching', label: 'Scenario', desc: 'Branching decision' },
  { id: 'title', label: 'Title', desc: 'Section opener' },
];
