'use strict';
const assert = require('node:assert/strict');
const { Battle } = require('../../dist/sim/battle');
const { TeamValidator } = require('../../dist/sim/team-validator');
const catalog = require('../../data/mods/gen9tmt2seed/catalog.json');
const id = catalog.metadata.formatID;
const team = () => structuredClone(catalog.seed.teams[1].sets).map(s => ({ ...s, item: s.item === 'none' ? '' : s.item }));

// Pending is deliberate until a validated selected dataset exposes the form.
(catalog.seed.forms?.length ? describe : describe.skip)('TMT-08 selected Mega Pidgeot (Gen9 adaptation, not ROM oracle)', () => {
	let b;
	afterEach(() => { b?.destroy(); b = null; });
	function create() {
		const result = new Battle({ formatid: id, seed: [1, 2, 3, 4],
			p1: { name: 'A', team: team() }, p2: { name: 'B', team: team() } });
		result.makeChoices('team 3', 'team 3');
		return result;
	}
	it('activates through a real choice before its move, changes stats/ability/types and consumes one use', () => {
		b = create(); const p = b.p1.active[0];
		assert.deepEqual(p.types, ['Bird', 'Bird', 'Bird']);
		assert.equal(p.canMegaEvo, 'Pidgeot-Mega');
		const hp = p.maxhp;
		b.makeChoices('move gust mega', 'move protect');
		assert.equal(p.species.id, 'pidgeotmega'); assert.equal(p.ability, 'noguard');
		assert.deepEqual(p.types, ['Holy', 'Bird', 'Bird']); assert.equal(p.addedType, '');
		assert.equal(p.maxhp, hp); assert.equal(p.storedStats.spa, 155); assert.equal(p.storedStats.spe, 141);
		assert(b.p1.pokemon.every(q => !q.canMegaEvo));
		const mega = b.log.findIndex(l => l.startsWith('|-mega|p1'));
		assert(mega >= 0 && mega < b.log.findIndex(l => l.startsWith('|move|p1')));
		assert.equal(p.canTerastallize, null);
	});
	it('retains mega on switching, resets replacement and added types, and starts a fresh battle in base form', () => {
		b = create(); const p = b.p1.active[0];
		b.makeChoices('move gust mega', 'move protect');
		p.addType('Grass'); assert.deepEqual(p.getTypes(), ['Holy', 'Bird', 'Bird', 'Grass']);
		p.setType('Water'); assert.deepEqual(p.getTypes(), ['Water']); assert.equal(p.addedType, '');
		b.makeChoices('switch 2', 'move protect'); b.makeChoices(`switch ${p.position + 1}`, 'move protect');
		assert.deepEqual(p.getTypes(), ['Holy', 'Bird', 'Bird']); assert.equal(p.species.id, 'pidgeotmega');
		b.destroy(); b = create(); assert.equal(b.p1.active[0].species.id, 'pidgeot');
		assert.deepEqual(b.p1.active[0].getTypes(), ['Bird', 'Bird', 'Bird']);
	});
	it('core oracle preserves a temporary fourth slot, replaces rather than deduplicates, and restores base types', () => {
		b = create(); const p = b.p1.active[0];
		p.addType('Grass'); assert.deepEqual(p.getTypes(), ['Bird', 'Bird', 'Bird', 'Grass']);
		p.addType('Water'); assert.deepEqual(p.getTypes(), ['Bird', 'Bird', 'Bird', 'Water']);
		p.setType(['Water', 'Water']); assert.deepEqual(p.getTypes(), ['Water', 'Water']);
		b.makeChoices('switch 2', 'move protect'); b.makeChoices(`switch ${p.position + 1}`, 'move protect');
		assert.deepEqual(p.getTypes(), ['Bird', 'Bird', 'Bird']);
	});
	it('defensive repeats multiply per slot; STAB matches once rather than stacking repeats', () => {
		b = create(); const p = b.p1.active[0], target = b.p2.active[0];
		assert.equal(p.runEffectiveness(b.dex.getActiveMove('rockthrow')), 3);
		b.makeChoices('move gust mega', 'move protect');
		assert.equal(p.runEffectiveness(b.dex.getActiveMove('rockthrow')), 3);
		const move = b.dex.getActiveMove('gust'); move.type = 'Bird'; move.willCrit = false;
		b.randomizer = n => n;
		const duplicated = b.actions.getDamage(p, target, move);
		p.setType('Bird'); assert.equal(b.actions.getDamage(p, target, move), duplicated);
		p.setType('Water'); assert(b.actions.getDamage(p, target, move) < duplicated);
	});
	it('No Guard is inherited for the selected inaccurate move on both sides', () => {
		b = create(); b.makeChoices('move gust mega', 'move protect');
		const rock = b.p2.pokemon.find(p => p.species.id === 'nosepass');
		b.makeChoices('move protect', 'switch 2');
		// Test callback under an explicit accuracy-zero control; not a ROM move definition.
		const move = b.dex.getActiveMove('rockthrow'); move.accuracy = 0;
		assert.equal(b.runEvent('Accuracy', b.p1.active[0], rock, move, move.accuracy), true);
	});
	it('rejects starting mega, incorrect stone, ability and moves while ordinary formats remain isolated', () => {
		assert.equal(TeamValidator.get(id).validateTeam(team()), null);
		for (const mutate of [s => { s[2].species = 'pidgeotmega'; }, s => { s[2].item = ''; },
			s => { s[0].item = 'pidgeotite'; }, s => { s[2].ability = 'noguard'; },
			s => { s[2].moves[0] = 'trickortreat'; }, s => { s[2].moves[0] = 'soak'; }]) {
			const sets = team(); mutate(sets); assert(TeamValidator.get(id).validateTeam(sets)?.length);
		}
		b = create(); assert.deepEqual(b.dex.mod('gen9').species.get('pidgeotmega').types, ['Normal', 'Flying']);
	});
});
