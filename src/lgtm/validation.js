import { getProperties, all } from './utils.js';

function Validation(attr) {
  this._attr = attr;
  this._conditions = [];
  this._subvalidations = [];
  this._dependencies = [];
}

Validation.prototype = {
  _attr: null,
  _conditions: null,
  _subvalidations: null,
  _dependencies: null,

  when(/* ...dependencies, predicate */) {
    let dependencies = [].slice.apply(arguments);
    const predicate = dependencies.pop();

    if (dependencies.length === 0) {
      dependencies = [this._attr];
    }

    this._conditions.push({
      predicate,
      dependencies
    });

    return this;
  },

  and(/* ...dependencies, condition */) {
    return this.when.apply(this, arguments);
  },

  using(/* ...dependencies, predicate, message */) {
    let dependencies = [].slice.apply(arguments);
    const message = dependencies.pop();
    const predicate = dependencies.pop();

    if (typeof message === 'undefined') {
      throw new Error(`expected a message but got: ${message}`);
    }

    if (typeof message === 'function' && typeof predicate === 'undefined') {
      throw new Error(
        'missing expected argument `message` after predicate function'
      );
    }

    if (dependencies.length === 0) {
      dependencies = [this._attr];
    }

    function validation(value, attr, object) {
      const properties = getProperties(object, dependencies);
      return predicate.apply(null, properties.concat([attr, object]));
    }

    const conditions = this._conditions.slice();

    function validationWithConditions(value, attr, object) {
      return all(
        conditions.map(({ predicate, dependencies }) => {
          const properties = getProperties(object, dependencies);
          return predicate.apply(null, properties.concat([attr, object]));
        })
      ).then(results => {
        for (let i = 0; i < results.length; i += 1) {
          // a condition resolved to a falsy value; return as valid
          if (!results[i]) {
            return true;
          }
        }
        // all conditions resolved to truthy values; continue with validation
        return validation(value, attr, object);
      });
    }

    this._subvalidations.push({
      dependencies,
      validation: conditions ? validationWithConditions : validation,
      message
    });

    return this;
  },

  addToValidator(validator) {
    this.dependencies().forEach(dependency => {
      validator.addDependentsFor(dependency, this._attr);
    });

    this._subvalidations.forEach(subvalidation => {
      validator.addValidation(
        this._attr,
        subvalidation.validation,
        subvalidation.message
      );
    });
  },

  dependencies() {
    const dependencies = [];

    this._conditions.forEach(condition => {
      condition.dependencies.forEach(dependency => {
        dependencies.push(dependency);
      });
    });

    this._subvalidations.forEach(subvalidation => {
      subvalidation.dependencies.forEach(dependency => {
        dependencies.push(dependency);
      });
    });

    return dependencies;
  }
};

export default Validation;
