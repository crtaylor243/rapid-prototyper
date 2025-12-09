const promptIdeas = [
  'Design a pricing section with toggles for monthly and annual billing and highlight the preferred plan.',
  'Create a project health dashboard with status badges, SLA countdowns, and quick action buttons.',
  'Build a customer onboarding checklist with progress indicators and contextual tips for each item.',
  'Mock up a support inbox split view with a searchable list of tickets and details on the right.',
  'Construct a responsive hero layout for a product launch with testimonial quotes and call-to-action buttons.'
];

const statuses = ['pending', 'building', 'ready'];

function buildTitle(promptText) {
  const normalized = promptText.trim();
  if (!normalized) {
    return 'Untitled prompt';
  }

  const maxLength = 48;
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  await knex('prompts').del();
  const users = await knex('users').select('id', 'email');

  const rows = [];
  users.forEach((user, userIndex) => {
    const charSeed = user.email.charCodeAt(0);
    const promptCount = (charSeed + userIndex) % 2 === 0 ? 2 : 1;

    for (let i = 0; i < promptCount; i += 1) {
      const ideaIndex = Math.abs(charSeed + i * 7 + userIndex) % promptIdeas.length;
      const promptText = promptIdeas[ideaIndex];
      rows.push({
        user_id: user.id,
        prompt_text: promptText,
        title: buildTitle(promptText),
        status: statuses[(ideaIndex + i) % statuses.length]
      });
    }
  });

  if (rows.length > 0) {
    await knex('prompts').insert(rows);
  }

  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Seeded prompt history for users',
      promptCount: rows.length
    })
  );
};
