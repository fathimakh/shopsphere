#!/usr/bin/env python3
"""
Static checker for the RapidMiner process files in rapidminer/processes/ (Python 3 stdlib only).

The .rmp files were written by hand because Altair AI Studio was not available while the project
was built, so this script checks everything that can be checked without running RapidMiner:

  * well-formed XML, <process version> root, <context><macros> declarations
  * every operator class is one of the verified operators below
  * every parameter / list key is a known key of that operator, and category-type values
    (measure, coding type, sort direction, ...) are valid choices
  * every <connect> joins existing operators in the same subprocess, uses real port names
    (including port extenders such as "output 2", "example set 1", "result 3"), and no input
    port is connected twice; every required input port is connected
  * every %{macro} used is declared in the process context or is a predefined RapidMiner macro

The tables below were transcribed from the open-source RapidMiner Studio 9.7 code (see
rapidminer/VERIFICATION.md). With --studio-src they are re-verified against a checkout of
https://github.com/rapidminer/rapidminer-studio: operator keys/classes in OperatorsCore.xml, and
parameter keys, enum values and port names as string literals in the operator's class hierarchy.

Usage:
  python3 rapidminer/tools/validate_processes.py [--studio-src <rapidminer-studio checkout>] [files...]
Exit code 0 when every check passes, 1 otherwise.
"""
import argparse
import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
PROCESS_DIR = os.path.join(os.path.dirname(HERE), 'processes')

SUBSET = ['attribute_filter_type', 'attribute', 'attributes', 'regular_expression', 'invert_selection',
          'include_special_attributes', 'value_type', 'use_value_type_exception', 'except_value_type',
          'block_type', 'use_block_type_exception', 'except_block_type', 'use_except_expression', 'except_regular_expression']
EXAMPLE_SET_IO = {'in': ['example set input'], 'out': ['example set output', 'original']}
PREPROCESSING_IO = {'in': ['example set input'], 'out': ['example set output', 'original', 'preprocessing model']}
FILTER_TYPES = ['all', 'single', 'subset', 'regular_expression', 'value_type', 'block_type', 'no_missing_values', 'numeric_value_filter']
VALUE_TYPES = ['attribute_value', 'nominal', 'numeric', 'integer', 'real', 'text', 'binominal', 'polynominal',
               'file_path', 'date_time', 'date', 'time']

# operator key -> java class, ports, parameter keys (+ list keys), allowed values for category parameters.
# Port names ending in " N" are port extenders (N = 1, 2, ...). 'optional' inputs need no connection.
OPERATORS = {
    'read_csv': {
        'class': 'com.rapidminer.operator.nio.CSVExampleSource',
        'in': ['file'], 'optional': ['file'], 'out': ['output'],
        'params': ['csv_file', 'column_separators', 'trim_lines', 'use_quotes', 'quotes_character', 'escape_character',
                   'skip_comments', 'comment_characters', 'starting_row', 'first_row_as_names', 'encoding',
                   'read_all_values_as_polynominal', 'read_not_matching_values_as_missings'],
        'lists': ['data_set_meta_data_information'],
    },
    'write_csv': {
        'class': 'com.rapidminer.operator.io.CSVExampleSetWriter',
        'in': ['input'], 'out': ['through', 'file'],
        'params': ['csv_file', 'column_separator', 'write_attribute_names', 'quote_nominal_values', 'format_date_attributes',
                   'append_to_file', 'encoding'],
    },
    'pivot': {
        'class': 'com.rapidminer.operator.preprocessing.transformation.Example2AttributePivoting', **EXAMPLE_SET_IO,
        'params': ['group_attribute', 'index_attribute', 'consider_weights', 'skip_constant_attributes'],
    },
    'set_role': {
        'class': 'com.rapidminer.operator.preprocessing.filter.ChangeAttributeRole', **EXAMPLE_SET_IO,
        'params': ['attribute_name', 'target_role'], 'lists': ['set_additional_roles'],
        'values': {'target_role': ['regular', 'id', 'label', 'prediction', 'cluster', 'weight', 'batch']},
    },
    'replace_missing_values': {
        'class': 'com.rapidminer.operator.preprocessing.filter.MissingValueReplenishment', **PREPROCESSING_IO,
        'params': SUBSET + ['default'], 'lists': ['columns'],
        'values': {'default': ['none', 'minimum', 'maximum', 'average', 'zero', 'value']},
    },
    'multiply': {'class': 'com.rapidminer.operator.IOMultiplier', 'in': ['input'], 'out': ['output N'], 'params': []},
    'cross_distances': {
        'class': 'com.rapidminer.operator.similarity.CrossDistancesOperator',
        'in': ['request set', 'reference set'], 'out': ['result set', 'request set', 'reference set'],
        'params': ['measure_types', 'numerical_measure', 'only_top_k', 'k', 'search_for', 'compute_similarities'],
        'values': {'measure_types': ['MixedMeasures', 'NominalMeasures', 'NumericalMeasures', 'BregmanDivergences'],
                   'numerical_measure': ['EuclideanDistance', 'CamberraDistance', 'ChebychevDistance', 'CorrelationSimilarity',
                                         'CosineSimilarity', 'DiceSimilarity', 'DynamicTimeWarpingDistance', 'InnerProductSimilarity',
                                         'JaccardSimilarity', 'KernelEuclideanDistance', 'ManhattanDistance',
                                         'MaxProductSimilarity', 'OverlapSimilarity'],
                   'search_for': ['nearest', 'farthest']},
    },
    'filter_examples': {
        'class': 'com.rapidminer.operator.preprocessing.filter.ExampleFilter',
        'in': ['example set input'], 'out': ['example set output', 'original', 'unmatched example set'],
        'params': ['parameter_expression', 'condition_class', 'invert_filter'],
        'values': {'condition_class': ['all', 'correct_predictions', 'wrong_predictions', 'no_missing_attributes',
                                       'missing_attributes', 'no_missing_labels', 'missing_labels', 'attribute_value_filter',
                                       'expression', 'custom_filters']},
    },
    'rename': {
        'class': 'com.rapidminer.operator.preprocessing.filter.ChangeAttributeName', **EXAMPLE_SET_IO,
        'params': ['old_name', 'new_name'], 'lists': ['rename_additional_attributes'],
    },
    'generate_attributes': {
        'class': 'com.rapidminer.operator.features.construction.AttributeConstruction', **EXAMPLE_SET_IO,
        'params': ['keep_all'], 'lists': ['function_descriptions'],
    },
    'select_attributes': {
        'class': 'com.rapidminer.operator.preprocessing.filter.attributes.AttributeFilter', **EXAMPLE_SET_IO, 'params': SUBSET,
    },
    'split': {
        'class': 'com.rapidminer.operator.preprocessing.filter.AttributeValueSplit', **EXAMPLE_SET_IO,
        'params': SUBSET + ['split_pattern', 'split_mode'],
        'values': {'split_mode': ['ordered_split', 'unordered_split']},
    },
    'nominal_to_numerical': {
        'class': 'com.rapidminer.operator.preprocessing.filter.NominalToNumeric', **PREPROCESSING_IO,
        'params': SUBSET + ['coding_type', 'use_comparison_groups', 'use_underscore_in_name'],
        'values': {'coding_type': ['dummy coding', 'effect coding', 'unique integers']},
    },
    'normalize': {
        'class': 'com.rapidminer.operator.preprocessing.normalization.Normalization', **PREPROCESSING_IO,
        'params': SUBSET + ['method', 'min', 'max'],
        'values': {'method': ['Z-transformation', 'range transformation', 'proportion transformation', 'interquartile range']},
    },
    'append': {'class': 'com.rapidminer.operator.preprocessing.join.ExampleSetMerge', 'in': ['example set N'], 'out': ['merged set'], 'params': []},
    'aggregate': {
        'class': 'com.rapidminer.operator.preprocessing.transformation.aggregation.AggregationOperator', **EXAMPLE_SET_IO,
        'params': SUBSET + ['use_default_aggregation', 'default_aggregation_function', 'group_by_attributes',
                            'count_all_combinations', 'only_distinct', 'ignore_missings'],
        'lists': ['aggregation_attributes'],
    },
    'sort': {
        'class': 'com.rapidminer.operator.preprocessing.filter.Sorting', **EXAMPLE_SET_IO,
        'params': ['attribute_name', 'sorting_direction'], 'values': {'sorting_direction': ['increasing', 'decreasing']},
    },
    'join': {
        'class': 'com.rapidminer.operator.preprocessing.join.ExampleSetJoin', 'in': ['left', 'right'], 'out': ['join'],
        'params': ['remove_double_attributes', 'join_type', 'use_id_attribute_as_key', 'keep_both_join_attributes'],
        'lists': ['key_attributes'], 'values': {'join_type': ['inner', 'left', 'right', 'outer']},
    },
    'set_minus': {
        'class': 'com.rapidminer.operator.preprocessing.join.ExampleSetMinus',
        'in': ['example set input', 'subtrahend'], 'out': ['example set output', 'original'], 'params': [],
    },
    'filter_example_range': {
        'class': 'com.rapidminer.operator.preprocessing.filter.ExampleRangeFilter', **EXAMPLE_SET_IO,
        'params': ['first_example', 'last_example', 'invert_filter'],
    },
    'branch': {
        'class': 'com.rapidminer.operator.meta.branch.ProcessBranch',
        'in': ['condition', 'input N'], 'optional': ['condition', 'input N'], 'out': ['input N'],
        'inner_sources': ['condition', 'input N'], 'inner_sinks': ['input N'], 'subprocesses': 2,
        'params': ['condition_type', 'expression', 'condition_value', 'return_inner_output'],
        'values': {'condition_type': ['attribute_value_filter', 'attribute_available', 'min_examples', 'max_examples',
                                      'min_attributes', 'max_attributes', 'min_fitness', 'max_fitness', 'min_performance_value',
                                      'max_performance_value', 'file_exists', 'input_exists', 'macro_defined', 'expression']},
    },
}
for spec in OPERATORS.values():
    if 'attribute_filter_type' in spec['params']:
        spec.setdefault('values', {})['attribute_filter_type'] = FILTER_TYPES
ROOT_PARAMS = ['logverbosity', 'random_seed', 'send_mail', 'notification_email', 'process_duration_for_mail', 'encoding']
ROOT_IO = {'inner_sources': ['input N'], 'inner_sinks': ['result N']}
# MacroHandler.ALL_PREDEFINED_MACROS
PREDEFINED_MACROS = {'process_name', 'process_file', 'process_path', 'process_start', 'a', 'execution_count', 'b', 'c', 'n',
                     'operator_name', 't', 'tempdir'}
MACRO_RE = re.compile(r'%\{([^}]+)\}')


def port_matches(name, allowed):
    """True when `name` is one of `allowed`, where "x N" stands for "x 1", "x 2", ..."""
    for port in allowed:
        if port.endswith(' N'):
            if re.fullmatch(re.escape(port[:-2]) + r' [1-9]\d*', name):
                return True
        elif name == port:
            return True
    return False


class Checker:
    def __init__(self, path):
        self.path = os.path.relpath(path)
        self.errors = []
        self.operators = 0
        self.connections = 0

    def error(self, message):
        self.errors.append(message)

    def run(self):
        try:
            root = ET.parse(self.path).getroot()
        except ET.ParseError as err:
            self.error(f'XML is not well formed: {err}')
            return self
        if root.tag != 'process' or not root.get('version'):
            self.error('root element must be <process version="...">')
        context = root.find('context')
        macros_el = context.find('macros') if context is not None else None
        if macros_el is None:
            self.error('missing <context><macros>')
            declared = set()
        else:
            declared = {(m.findtext('key') or '').strip() for m in macros_el.findall('macro')}
        self.known_macros = declared | PREDEFINED_MACROS
        top = root.find('operator')
        if top is None or top.get('class') != 'process':
            self.error('the root must contain <operator class="process">')
            return self
        self.check_params(top, ROOT_PARAMS, [], {})
        units = top.findall('process')
        if len(units) != 1:
            self.error('the root operator must have exactly one <process>')
        for unit in units:
            self.check_unit(unit, 'Process', ROOT_IO)
        return self

    def check_params(self, op, keys, list_keys, values, label='Process'):
        for param in op.findall('parameter'):
            key, value = param.get('key'), param.get('value', '')
            if key not in keys:
                self.error(f'{label}: unknown parameter "{key}"')
            if key in values and not MACRO_RE.search(value) and value not in values[key]:
                self.error(f'{label}: invalid value "{value}" for "{key}" (allowed: {", ".join(values[key])})')
            self.check_macros(value, label)
        for lst in op.findall('list'):
            if lst.get('key') not in list_keys:
                self.error(f'{label}: unknown list parameter "{lst.get("key")}"')
            for entry in lst.findall('parameter'):
                self.check_macros(entry.get('key', ''), label)
                self.check_macros(entry.get('value', ''), label)
                if lst.get('key') == 'data_set_meta_data_information':
                    parts = entry.get('value', '').split('.')
                    if len(parts) != 4 or parts[1] not in ('true', 'false') or parts[2] not in VALUE_TYPES:
                        self.error(f'{label}: bad column meta data "{entry.get("value")}" (name.selected.value_type.role)')

    def check_macros(self, text, label):
        for name in MACRO_RE.findall(text or ''):
            if name not in self.known_macros:
                self.error(f'{label}: macro %{{{name}}} is neither declared in the context nor predefined')

    def check_unit(self, unit, owner, owner_io):
        ops = {}
        for op in unit.findall('operator'):
            name, cls = op.get('name'), op.get('class')
            self.operators += 1
            if name in ops:
                self.error(f'{owner}: duplicate operator name "{name}"')
            ops[name] = op
            spec = OPERATORS.get(cls)
            if spec is None:
                self.error(f'{name}: operator class "{cls}" is not in the verified list')
                continue
            self.check_params(op, spec['params'], spec.get('lists', []), spec.get('values', {}), name)
            subs = op.findall('process')
            if len(subs) != spec.get('subprocesses', 0):
                self.error(f'{name}: expected {spec.get("subprocesses", 0)} subprocess(es), found {len(subs)}')
            for sub in subs:
                self.check_unit(sub, name, spec)

        connected_inputs = set()
        for conn in unit.findall('connect'):
            self.connections += 1
            from_op, from_port = conn.get('from_op'), conn.get('from_port')
            to_op, to_port = conn.get('to_op'), conn.get('to_port')
            if from_op:
                if from_op not in ops:
                    self.error(f'{owner}: connect from unknown operator "{from_op}"')
                else:
                    spec = OPERATORS.get(ops[from_op].get('class'), {})
                    if spec and not port_matches(from_port, spec['out']):
                        self.error(f'{from_op}: no output port "{from_port}" (has: {", ".join(spec["out"])})')
            elif not port_matches(from_port, owner_io.get('inner_sources', [])):
                self.error(f'{owner}: no inner source port "{from_port}"')
            if to_op:
                if to_op not in ops:
                    self.error(f'{owner}: connect to unknown operator "{to_op}"')
                else:
                    spec = OPERATORS.get(ops[to_op].get('class'), {})
                    if spec and not port_matches(to_port, spec['in']):
                        self.error(f'{to_op}: no input port "{to_port}" (has: {", ".join(spec["in"])})')
            elif not port_matches(to_port, owner_io.get('inner_sinks', [])):
                self.error(f'{owner}: no inner sink port "{to_port}"')
            target = (to_op, to_port)
            if target in connected_inputs:
                self.error(f'{owner}: input "{to_port}" of "{to_op or owner}" is connected twice')
            connected_inputs.add(target)

        for name, op in ops.items():
            spec = OPERATORS.get(op.get('class'))
            if not spec:
                continue
            for port in spec['in']:
                if port in spec.get('optional', []) or port.endswith(' N'):
                    continue
                if (name, port) not in connected_inputs:
                    self.error(f'{name}: required input port "{port}" is not connected')
            if any(p.endswith(' N') for p in spec['in']) and spec['in'] == ['example set N']:
                if not any(c[0] == name for c in connected_inputs):
                    self.error(f'{name}: no input connected')


# ---------------------------------------------------------------------------------------------
# --studio-src: re-verify the tables above against the RapidMiner Studio source code
# ---------------------------------------------------------------------------------------------
SHARED_SOURCES = [  # parameter types that operators add from helper classes
    'operator/tools/AttributeSubsetSelector.java', 'operator/preprocessing/filter/attributes',
    'tools/math/similarity/DistanceMeasures.java', 'tools/io/Encoding.java', 'operator/preprocessing/normalization',
    'example/set/ConditionedExampleSet.java', 'example/set/SortedExampleSet.java', 'tools/Ontology.java',
    'example/Attributes.java',
]


def verify_against_source(src_root):
    java_root = os.path.join(src_root, 'src', 'main', 'java', 'com', 'rapidminer')
    core_xml = os.path.join(src_root, 'src', 'main', 'resources', 'com', 'rapidminer', 'resources', 'OperatorsCore.xml')
    problems = []
    if not os.path.isfile(core_xml):
        return [f'OperatorsCore.xml not found under {src_root}']
    registry = {}
    for block in re.findall(r'<operator>(.*?)</operator>', open(core_xml, encoding='utf-8').read(), re.S):
        key, cls = re.search(r'<key>([^<]+)</key>', block), re.search(r'<class>([^<]+)</class>', block)
        if key and cls:
            registry[key.group(1).strip()] = cls.group(1).strip()

    def read(path):
        with open(path, encoding='utf-8', errors='replace') as fh:
            return fh.read()

    def class_file(fqcn):
        return os.path.join(src_root, 'src', 'main', 'java', *fqcn.split('.')) + '.java'

    def chain(fqcn):
        files, current, seen = [], class_file(fqcn), set()
        while current and os.path.isfile(current) and current not in seen:
            seen.add(current)
            text = read(current)
            files.append(text)
            simple = os.path.basename(current)[:-5]
            match = re.search(r'class\s+' + simple + r'\b[^{]*?\bextends\s+([A-Za-z0-9_]+)', text)
            if not match:
                break
            parent = match.group(1)
            imported = re.search(r'import\s+([\w.]+\.' + parent + r');', text)
            current = class_file(imported.group(1)) if imported else os.path.join(os.path.dirname(current), parent + '.java')
        return files

    shared = []
    for rel in SHARED_SOURCES:
        path = os.path.join(java_root, rel)
        if os.path.isdir(path):
            shared += [read(os.path.join(path, f)) for f in sorted(os.listdir(path)) if f.endswith('.java')]
        elif os.path.isfile(path):
            shared.append(read(path))
        else:
            problems.append(f'shared source not found: {rel}')

    for key, spec in OPERATORS.items():
        if registry.get(key) != spec['class']:
            problems.append(f'{key}: OperatorsCore.xml maps it to {registry.get(key)}, expected {spec["class"]}')
            continue
        own = chain(spec['class'])
        if not own:
            problems.append(f'{key}: source of {spec["class"]} not found')
            continue
        text = '\n'.join(own + shared)
        literal = lambda s: f'"{s}"' in text
        for param in spec['params'] + spec.get('lists', []):
            if not literal(param):
                problems.append(f'{key}: parameter key "{param}" not found in the operator sources')
        for param, values in spec.get('values', {}).items():
            for value in values:
                if not literal(value):
                    problems.append(f'{key}: value "{value}" of "{param}" not found in the operator sources')
        own_text = '\n'.join(own)
        for port in spec['in'] + spec['out'] + spec.get('inner_sources', []) + spec.get('inner_sinks', []):
            base = port[:-2] if port.endswith(' N') else port
            if f'"{base}"' not in own_text:
                problems.append(f'{key}: port name "{base}" not found in {spec["class"]} or its superclasses')
    return problems


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('files', nargs='*', help='process files (default: rapidminer/processes/*.rmp)')
    parser.add_argument('--studio-src', help='checkout of github.com/rapidminer/rapidminer-studio to re-verify the operator tables')
    args = parser.parse_args()
    files = args.files or sorted(os.path.join(PROCESS_DIR, f) for f in os.listdir(PROCESS_DIR) if f.endswith('.rmp'))
    failed = False

    if args.studio_src:
        problems = verify_against_source(args.studio_src)
        print(f'Operator tables vs RapidMiner Studio source ({len(OPERATORS)} operators): '
              f'{"OK" if not problems else f"{len(problems)} problem(s)"}')
        for problem in problems:
            print(f'  - {problem}')
        failed |= bool(problems)

    for path in files:
        result = Checker(path).run()
        status = 'OK' if not result.errors else f'{len(result.errors)} error(s)'
        print(f'{result.path}: {result.operators} operators, {result.connections} connections - {status}')
        for message in result.errors:
            print(f'  - {message}')
        failed |= bool(result.errors)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
