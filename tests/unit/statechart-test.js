import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import { statechart } from 'ember-statecharts/computed';
import { timeout } from 'ember-concurrency';
import { run } from '@ember/runloop';

module('Unit | computed | statechart', function () {
  test('it adds statechart functionality to an ember-object', async function (assert) {
    assert.expect(5);

    let subject = EmberObject.extend({
      statechart: statechart(
        {
          initial: 'new',
          states: {
            new: {
              onExit() {
                assert.ok(true, 'exitState was called');
              },
              on: {
                woot: {
                  target: 'foo',
                  actions: ['handleFoo'],
                },
              },
            },
            foo: {
              onEntry(_context, { type, ...data }) {
                assert.deepEqual(data, testData, 'passed data is available in eventObject');
              },
            },
          },
        },
        {
          actions: {
            handleFoo() {
              assert.ok(true, 'event was called');
            },
          },
        }
      ),
    }).create();

    const testData = { wat: 'lol' };

    assert.equal(subject.statechart.currentState.value, 'new');

    subject.statechart.send('woot', testData);

    assert.equal(subject.statechart.currentState.value, 'foo');
  });

  test('it is possible to pass statechart-options to the statechart when passing an array of params', async function (assert) {
    assert.expect(5);

    let subject = EmberObject.extend({
      name: 'Tomster',

      power: null,

      statechart: statechart(
        {
          initial: 'powerOff',
          states: {
            powerOff: {
              on: {
                power: {
                  target: 'powerOn',
                  cond: 'enoughPowerIsAvailable',
                },
              },
            },
            powerOn: {},
          },
        },
        {
          guards: {
            enoughPowerIsAvailable: (context, { power }) => {
              assert.equal(context.name, 'Tomster', 'accessing context works');

              return power > 9000;
            },
          },
        }
      ),
    }).create();

    assert.equal(
      subject.statechart.currentState.value,
      'powerOff',
      'passing an array as a statechart property works'
    );

    await subject.get('statechart').send('power', { power: 1 });

    assert.equal(
      subject.statechart.currentState.value,
      'powerOff',
      'guards will not execute transition when a falsy value is returned'
    );

    await subject.get('statechart').send('power', { power: 9001 });

    assert.equal(
      subject.statechart.currentState.value,
      'powerOn',
      'returning a truthy from a guard executes the transition'
    );
  });

  test('statechart services will be cleaned properly when the object containing the statechart is destroyed', async function (assert) {
    const subject = EmberObject.extend({
      offCounter: 0,
      statechart: statechart(
        {
          initial: 'powerOff',
          states: {
            powerOff: {
              onEntry: ['incrementOffCounter'],
              on: {
                POWER: 'powerOn',
              },
            },
            powerOn: {
              after: {
                1000: 'powerOff',
              },
            },
          },
        },
        {
          actions: {
            incrementOffCounter(context) {
              context.incrementProperty('offCounter');
            },
          },
        }
      ),

      willDestroy() {
        this._super(...arguments);

        assert.step('willDestroy hook is called correctly');
      },
    }).create();

    assert.equal(subject.statechart.currentState.value, 'powerOff');
    assert.equal(subject.offCounter, 1, 'offCounter was incremented as expected');

    subject.statechart.send('POWER');

    await timeout(300);

    assert.equal(subject.statechart.currentState.value, 'powerOn');

    // will fail with `calling set on destroyed object` if  this doesn't work
    await run(() => subject.destroy());

    assert.verifySteps(['willDestroy hook is called correctly']);
  });
});
