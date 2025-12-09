/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('prompts', (table) => {
    table.text('jsx_source');
    table.text('compiled_js');
    table.text('render_error');
    table.string('preview_slug', 128);
    table.jsonb('sandbox_config');
  });

  await knex.schema.createTable('prompt_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table
      .uuid('prompt_id')
      .notNullable()
      .references('id')
      .inTable('prompts')
      .onDelete('CASCADE');
    table.string('level', 16).notNullable().defaultTo('info');
    table.text('message').notNullable();
    table.jsonb('context');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['prompt_id', 'created_at']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('prompt_events');
  await knex.schema.alterTable('prompts', (table) => {
    table.dropColumn('jsx_source');
    table.dropColumn('compiled_js');
    table.dropColumn('render_error');
    table.dropColumn('preview_slug');
    table.dropColumn('sandbox_config');
  });
};
