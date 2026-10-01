'use strict';
const assert = require('node:assert/strict');
const { Battle } = require('../../dist/sim/battle');
const { TeamValidator } = require('../../dist/sim/team-validator');
const { Teams } = require('../../dist/sim/teams');
const catalog = require('../../data/mods/gen9tmt2seed/catalog.json');
const id = catalog.metadata.formatID;
const team = n => structuredClone(catalog.seed.teams[n].sets).map(s => ({ ...s, item: '' }));
function battle(a = 0, b = 1, leadA = 1, leadB = 1) {
	const result = new Battle({ formatid: id, seed: [1, 2, 3, 4],
		p1: { name: 'Alpha', team: team(a) }, p2: { name: 'Beta', team: team(b) } });
	result.makeChoices(`team ${leadA}`, `team ${leadB}`);
	return result;
}
function damage(b, source, target, move) {
	const active = b.dex.getActiveMove(move);
	active.willCrit = false;
	b.randomizer = n => n; // Maximum deterministic damage roll, not a production rule.
	return target.runImmunity(active) ? b.actions.getDamage(source, target, active) : false;
}

describe('TMT-06 bounded premade legality', () => {
	it('accepts both premades, reordered sets/moves and packed defaults', () => {
		for (const n of [0, 1]) {
			const sets = team(n).reverse();
			for (const s of sets) {
				s.moves.reverse(); delete s.evs; delete s.ivs;
			}
			const unpacked = Teams.unpack(Teams.pack(sets));
			assert.equal(TeamValidator.get(id).validateTeam(unpacked), null);
			for (const s of unpacked) {
				assert.deepEqual(Object.values(s.evs), [0, 0, 0, 0, 0, 0]);
				assert.deepEqual(Object.values(s.ivs), [31, 31, 31, 31, 31, 31]);
			}
		}
	});
	const invalid = {
		'outside species': s => { s[0].species = 'mew'; },
		'alternate starting form': s => { s[0].species = 'rattataalola'; },
		'duplicate roster': s => { s[1] = structuredClone(s[0]); },
		'mixed roster': s => { s[0] = team(1)[0]; },
		'outside move': s => { s[0].moves[0] = 'surf'; },
		'engine-only Struggle': s => { s[0].moves[0] = 'struggle'; },
		'duplicate move': s => { s[0].moves[1] = s[0].moves[0]; },
		'outside ability': s => { s[0].ability = 'guts'; },
		'held item': s => { s[0].item = 'leftovers'; },
		'wrong nature': s => { s[0].nature = 'Adamant'; },
		'level silently clamped by baseline': s => { s[0].level = 100; },
		'low level': s => { s[0].level = 49; },
		'missing level': s => { delete s[0].level; },
		'EV influence': s => { s[0].evs.atk = 252; },
		'negative EV': s => { s[0].evs.hp = -1; },
		'nonfinite EV': s => { s[0].evs.hp = NaN; },
		'string EV': s => { s[0].evs.hp = '0'; },
		'wrong IV': s => { s[0].ivs.spe = 30; },
		'unknown stat': s => { s[0].evs.extra = 0; },
		'raw stats injection': s => { s[0].stats = { atk: 999 }; },
		'adjusted level injection': s => { s[0].adjustLevel = 100; },
		'Tera request': s => { s[0].teraType = 'Water'; },
		'Gigantamax request': s => { s[0].gigantamax = true; },
		'wrong team size': s => { s.pop(); },
	};
	for (const [label, mutate] of Object.entries(invalid)) {
		it(`rejects ${label} before baseline normalization`, () => {
			const sets = team(0); mutate(sets);
			assert(TeamValidator.get(id).validateTeam(sets)?.length);
		});
	}
	it('rejects custom rule removal and direct simulator bypass', () => {
		assert(TeamValidator.get(`${id}@@@!Terastal Clause`).validateTeam(team(0))?.length);
		const sets = team(0); sets[0].evs.atk = 252;
		assert.throws(() => new Battle({ formatid: id, p1: { name: 'A', team: sets },
			p2: { name: 'B', team: team(1) } }), /Invalid TMT2 premade/);
	});
});

describe('TMT-06 actual mod runtime (approved Gen9 adaptation, not ROM oracle)', () => {
	let b;
	afterEach(() => { b?.destroy(); b = null; });
	it('uses level50 IV31 EV0 Hardy stats for all six and disables transformations', () => {
		b = battle();
		for (const p of [...b.p1.pokemon, ...b.p2.pokemon]) {
			for (const [stat, base] of Object.entries(p.species.baseStats)) {
				const expected = Math.floor((2 * base + 31) / 2) + (stat === 'hp' ? 60 : 5);
				assert.equal(stat === 'hp' ? p.maxhp : p.storedStats[stat], expected);
			}
			assert.equal(p.canTerastallize, null);
			assert.equal(p.getItem().id, '');
		}
		assert.throws(() => b.makeChoices('move tackle terastallize', 'move tackle'), /Not all choices done/);
	});
	it('resolves all nine selected damaging moves through real mod actions', () => {
		b = battle();
		// Fixed maximum-roll, noncritical adaptation regression values (not ROM measurements).
		const expected = {
			rattata: { tackle: 5, quickattack: 5, bite: 14 }, eevee: { tackle: 5, quickattack: 5, bite: 14 },
			froakie: { pound: 5, watergun: 44, quickattack: 5 }, nosepass: { tackle: 22, rockthrow: 84 },
			floragato: { scratch: 34, magicalleaf: 60, bite: 50 }, pidgeot: { tackle: 34, gust: 60, quickattack: 34 },
		};
		for (const side of [b.p1, b.p2]) for (const p of side.pokemon) {
			for (const move of p.set.moves) {
				if (b.dex.moves.get(move).category === 'Status') continue;
				const target = side.foe.pokemon.find(t => t.runImmunity(b.dex.moves.get(move)));
				assert.equal(damage(b, p, target, move), expected[p.species.id][move]);
			}
		}
	});
	it('uses repeated defensive multipliers and Water immunity from canonical chart', () => {
		b = battle();
		const frog = b.p1.pokemon.find(p => p.species.id === 'froakie');
		const bird = b.p2.pokemon.find(p => p.species.id === 'pidgeot');
		assert.deepEqual(bird.getTypes(), ['Bird', 'Bird', 'Bird']);
		assert.equal(bird.runEffectiveness(b.dex.getActiveMove('rockthrow')), 3);
		assert.equal(damage(b, frog, frog, 'watergun'), false);
		assert.equal(b.p1.pokemon[1].runEffectiveness(b.dex.getActiveMove('watergun')), 2);
		assert.equal(frog.getTypes().includes('Water'), true);
		// STAB is one 1.5x factor for membership, never repeated for duplicate slots.
		const source = b.p2.pokemon[0], target = b.p1.pokemon[0];
		const plain = damage(b, source, target, 'rockthrow');
		source.setType(['Rock', 'Rock', 'Rock'], true); // Explicit synthetic control in actual mod.
		assert.equal(damage(b, source, target, 'rockthrow'), plain);
		source.setType(['Rat'], true);
		assert(plain > damage(b, source, target, 'rockthrow'));
	});
	it('Protect blocks damage and priority lets slower Rattata act before Pidgeot', () => {
		b = battle(0, 1, 1, 3);
		const target = b.p2.active[0], hp = target.hp;
		b.makeChoices('move quickattack', 'move protect');
		assert.equal(target.hp, hp);
		b.makeChoices('move quickattack', 'move gust');
		const moves = b.log.filter(s => s.startsWith('|move|')).slice(-2);
		assert.match(moves[0], /Rattata\|Quick Attack/);
	});
	it('Thunder Wave and switching preserve status and permanent duplicate types', () => {
		b = battle(0, 1, 2, 1);
		b.makeChoices('move tackle', 'move thunderwave');
		assert.equal(b.p1.active[0].status, 'par');
		b.makeChoices('switch 2', 'switch 3');
		assert.deepEqual(b.p2.active[0].getTypes(), ['Bird', 'Bird', 'Bird']);
		b.makeChoices('switch 2', 'switch 3');
		assert.equal(b.p1.active[0].status, 'par');
	});
	it('Torrent and Overgrow boost their ordinary type only at low HP', () => {
		b = battle();
		for (const [index, move] of [[0, 'watergun'], [1, 'magicalleaf']]) {
			b.destroy(); b = battle(0, 1, 3, 2);
			const p = index === 0 ? b.p1.active[0] : b.p2.active[0];
			const target = b.p1.pokemon.find(p => p.species.id === 'rattata');
			const normal = damage(b, p, target, move);
			p.hp = Math.floor(p.maxhp / 3);
			assert(damage(b, p, target, move) > normal);
		}
	});
	it('Bite secondary flinch cancels the slower move in the same turn', () => {
		b = battle(); b.random = () => 0; // Force the 30% secondary roll only in this test.
		b.makeChoices('move bite', 'move rockthrow');
		assert(b.log.some(s => s.includes('|cant|p2a: Nosepass|flinch')));
		assert(!b.log.some(s => s.includes('|Rock Throw|')));
	});
	it('Keen Eye ignores target evasion; Run Away has no private battle modifier', () => {
		b = battle(0, 1, 1, 3);
		const bird = b.p2.active[0], target = b.p1.active[0];
		const move = b.dex.getActiveMove('gust');
		b.runEvent('ModifyMove', bird, target, move, move);
		assert.equal(move.ignoreEvasion, true);
		assert.equal(Object.keys(target.getAbility()).some(k => k.startsWith('on')), false);
	});
	it('Sturdy survives a full-HP lethal hit; Keen Eye rejects accuracy drops', () => {
		b = battle(0, 1, 3, 1);
		const nose = b.p2.active[0]; nose.hp = nose.maxhp = 1; // Controlled lethal setup.
		b.makeChoices('move watergun', 'move tackle');
		assert.equal(nose.hp, 1);
		assert(b.log.some(s => s.includes('|Sturdy')));
		nose.hp = 1; nose.maxhp = 105;
		b.makeChoices('move watergun', 'move tackle');
		assert.equal(nose.fainted, true);
		b.destroy(); b = battle(0, 1, 1, 3);
		const bird = b.p2.active[0];
		b.boost({ accuracy: -1 }, bird, b.p1.active[0]);
		assert.equal(bird.boosts.accuracy, 0);
	});
	it('PP exhaustion uses engine-only Struggle and recoil without legal roster leakage', () => {
		b = battle();
		const p = b.p1.active[0];
		for (const slot of p.moveSlots) slot.pp = 0;
		const hp = p.hp;
		b.makeChoices('move struggle', 'move tackle');
		assert(b.log.some(s => s.includes('|Struggle|')));
		assert(p.hp < hp);
		assert(b.log.some(s => s.includes('[from] recoil')));
		assert.equal(b.dex.moves.get('struggle').exists, true);
	});
	it('applies the canonical Water immunity during a real turn', () => {
		b = battle(0, 0, 3, 3);
		const target = b.p2.active[0], hp = target.hp;
		b.makeChoices('move watergun', 'move quickattack');
		assert.equal(target.hp, hp);
		assert(b.log.some(s => s.includes('|-immune|p2a: Froakie')));
	});
	it('finishes a deterministic local simulator match with automatic legal choices', () => {
		b = battle();
		for (let turn = 0; turn < 500 && !b.ended; turn++) b.makeChoices();
		assert.equal(b.ended, true);
		assert(b.log.some(s => s.startsWith('|win|')));
		assert(!b.log.some(s => s.startsWith('|error|')));
	});
});
