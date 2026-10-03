'use strict';
const assert = require('node:assert/strict');
const { TeamValidator } = require('../../dist/sim/team-validator');
const { Teams } = require('../../dist/sim/teams');
const catalog = require('../../data/mods/gen9tmt2seed/catalog.json');
const team = id => structuredClone(catalog.seed.teams.find(t => t.id === id).sets)
 .map(s => ({ ...s, item: s.item === 'none' ? '' : s.item }));

describe('TMT-10 authoritative teambuilder boundary (approved fixed premades)', () => {
 it('accepts text and packed roundtrips for all premades, reordered moves/sets and nicknames', () => {
  for (const premade of catalog.seed.teams) {
   const sets = team(premade.id).reverse();
   for (const set of sets) { set.name = 'Local nickname'; set.moves.reverse(); }
   for (const imported of [Teams.unpack(Teams.pack(sets)), Teams.import(Teams.export(sets))]) {
    assert.equal(TeamValidator.get(catalog.metadata.formatID).validateTeam(imported), null);
   }
  }
 });
 it('rejects EV, IV, nature and level mutations preserved through packed imports', () => {
  for (const [mutate, message] of [
   [s => { s[0].evs.atk = 252; }, /EVS must all be 0/],
   [s => { s[0].ivs.atk = 0; }, /IVS must all be 31/],
   [s => { s[0].nature = 'Adamant'; }, /Nature must be Hardy/],
   [s => { s[0].level = 100; }, /Level must be exactly 50/],
  ]) {
   const sets = team('alpha'); mutate(sets);
   const errors = TeamValidator.get(catalog.metadata.formatID).validateTeam(Teams.unpack(Teams.pack(sets)));
   assert(errors?.length); assert.match(errors.join('\n'), message);
  }
 });
 it('reports unsupported species/forms, pool references and mixed or duplicate rosters', () => {
  for (const [mutate, message] of [
   [s => { s[2].species = 'pidgeotmega'; }, /Species\/form outside/],
   [s => { s[0].species = 'mew'; }, /Species\/form outside/],
   [s => { s[0].moves[0] = 'surf'; }, /premade moves/],
   [s => { s[0].ability = 'noguard'; }, /Ability must match/],
   [s => { s[0].item = 'leftovers'; }, /Item must match/],
   [s => { s[0] = team('alpha')[0]; }, /mixed\/duplicate/],
   [s => { s[0] = structuredClone(s[1]); }, /mixed\/duplicate/],
  ]) {
   const sets = team('gamma'); mutate(sets);
   const errors = TeamValidator.get(catalog.metadata.formatID).validateTeam(sets);
   assert(errors?.length); assert.match(errors.join('\n'), message);
  }
 });
 it('keeps approved beta stone legal but rejects imported Tera and rule overrides', () => {
  assert.equal(TeamValidator.get(catalog.metadata.formatID).validateTeam(team('beta')), null);
  const sets = team('beta'); sets[2].teraType = 'Flying';
  assert.match(TeamValidator.get(catalog.metadata.formatID).validateTeam(sets).join('\n'), /Transformations/);
  assert(TeamValidator.get(catalog.metadata.formatID + '@@@!Terastal Clause').validateTeam(team('beta'))?.length);
 });
});
