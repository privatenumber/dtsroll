export const typesPrefix = '@types/';

export const getOriginalPackageName = (
	typePackageName: string,
) => {
	let originalPackageName = typePackageName.slice(typesPrefix.length);
	if (originalPackageName.includes('__')) {
		originalPackageName = `@${originalPackageName.replace('__', '/')}`;
	}
	return originalPackageName;
};

export const getPackageName = (
	id: string,
) => {
	let indexOfSlash = id.indexOf('/');
	if (indexOfSlash === -1) {
		return id;
	}

	if (id[0] === '@') {
		const secondSlash = id.indexOf('/', indexOfSlash + 1);
		if (secondSlash === -1) {
			return id;
		}
		indexOfSlash = secondSlash;
	}

	return id.slice(0, indexOfSlash);
};
