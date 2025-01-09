import { expect, testSuite } from 'manten';
import { createFixture } from 'fs-fixture';
import * as fixtures from '../fixtures';
import { dtsroll } from '#dtsroll';

export default testSuite(({ describe }) => {
	describe('node', ({ test }) => {
		test('Single entry-point', async () => {
			await using fixture = await createFixture(fixtures.singleEntryPoint);

			const generated = await dtsroll({
				inputs: [fixture.getPath('dist/entry.d.ts')],
			});

			expect(generated).toMatchObject({
				size: {
					input: 88,
					output: 65,
				},
			});
		});

		test('Multiple entry-point', async () => {
			await using fixture = await createFixture(fixtures.multipleEntryPoints);

			const generated = await dtsroll({
				inputs: [fixture.getPath('./dist/index.d.ts'), fixture.getPath('./dist/some-dir/index.d.ts')],
			});

			/**
			 * Output is slightly bigger because the input is so small
			 * and the built snytax is more verbose
			 * e.g. type a = 1; export { a as b }  vs export type b = 1;
			 */
			expect(generated).toMatchObject({
				size: {
					input: 165,
					output: 255,
				},
			});
		});
	});
});
