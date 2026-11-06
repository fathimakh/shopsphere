import com.rapidminer.Process;
import com.rapidminer.RapidMiner;
import com.rapidminer.example.Attribute;
import com.rapidminer.example.Example;
import com.rapidminer.example.ExampleSet;
import com.rapidminer.operator.IOContainer;
import com.rapidminer.operator.IOObject;
import com.rapidminer.operator.nio.CSVExampleSource;
import com.rapidminer.tools.LogService;
import com.rapidminer.tools.OperatorService;

import java.io.File;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Runs a RapidMiner process file headless with RapidMiner Studio Core 9.7.0 (the open-source engine of
 * RapidMiner Studio, AGPL-3.0). Started by run.sh, which downloads the engine with Maven.
 *
 * Usage: RunProcess <process.rmp> [macro=value ...] [--input=<csv>] [--result=<csv>]
 *   macro=value      sets a process macro, like the Context panel in Studio (e.g. input_file=...)
 *   --input=<csv>    feeds a CSV file to the process's first input port (what AI Hub does with a request)
 *   --result=<csv>   writes the first result port to a CSV file
 * With the environment variable RM_TRACE set, the row count of every operator's output is printed.
 */
public class RunProcess {
	public static void main(String[] args) throws Exception {
		Map<String, String> macros = new LinkedHashMap<>();
		List<String> inputs = new ArrayList<>();
		String resultFile = null;
		for (int i = 1; i < args.length; i++) {
			if (args[i].startsWith("--input=")) {
				inputs.add(args[i].substring(8));
			} else if (args[i].startsWith("--result=")) {
				resultFile = args[i].substring(9);
			} else {
				String[] kv = args[i].split("=", 2);
				macros.put(kv[0], kv[1]);
			}
		}
		RapidMiner.setExecutionMode(RapidMiner.ExecutionMode.COMMAND_LINE);
		RapidMiner.init();
		System.out.println("RapidMiner version: " + RapidMiner.getLongVersion());
		Process process = new Process(new File(args[0]));
		System.out.println("Process: " + args[0]);
		System.out.println("Macros: " + macros);

		List<IOObject> inputObjects = new ArrayList<>();
		for (String csv : inputs) {
			CSVExampleSource reader = OperatorService.createOperator(CSVExampleSource.class);
			reader.setParameter(CSVExampleSource.PARAMETER_CSV_FILE, csv);
			reader.setParameter(CSVExampleSource.PARAMETER_COLUMN_SEPARATORS, ",");
			ExampleSet input = reader.createExampleSet();
			System.out.println("Input " + csv + ": " + input.size() + " rows");
			inputObjects.add(input);
		}

		if (System.getenv("RM_TRACE") != null) {
			process.getRootOperator().addProcessListener(new com.rapidminer.ProcessListener() {
				public void processStarts(Process p) {}
				public void processStartedOperator(Process p, com.rapidminer.operator.Operator op) {}
				public void processFinishedOperator(Process p, com.rapidminer.operator.Operator op) {
					StringBuilder sb = new StringBuilder("TRACE " + op.getName() + ":");
					for (com.rapidminer.operator.ports.OutputPort port : op.getOutputPorts().getAllPorts()) {
						IOObject data = port.getRawData();
						if (data instanceof ExampleSet) {
							sb.append(" [").append(port.getName()).append(" ").append(((ExampleSet) data).size()).append(" rows]");
						}
					}
					System.out.println(sb);
				}
				public void processEnded(Process p) {}
			});
		}
		long start = System.currentTimeMillis();
		IOContainer results = process.run(new IOContainer(inputObjects), LogService.UNKNOWN_LEVEL, macros);
		System.out.println("Finished in " + (System.currentTimeMillis() - start) + " ms");
		boolean first = true;
		for (IOObject result : results.getIOObjects()) {
			if (!(result instanceof ExampleSet)) {
				System.out.println("Result: " + result.getClass().getSimpleName());
				continue;
			}
			ExampleSet set = (ExampleSet) result;
			List<Attribute> columns = new ArrayList<>();
			for (Iterator<Attribute> it = set.getAttributes().allAttributes(); it.hasNext(); ) {
				columns.add(it.next());
			}
			System.out.println("Result example set: " + set.size() + " rows, columns: " + names(columns));
			for (int row = 0; row < Math.min(5, set.size()); row++) {
				System.out.println("  " + line(set.getExample(row), columns));
			}
			if (first && resultFile != null) {
				try (PrintWriter out = new PrintWriter(resultFile, "UTF-8")) {
					out.println(names(columns));
					for (Example example : set) {
						out.println(line(example, columns));
					}
				}
				System.out.println("Wrote " + resultFile);
			}
			first = false;
		}
		System.exit(0);
	}

	private static String names(List<Attribute> columns) {
		StringBuilder sb = new StringBuilder();
		for (Attribute a : columns) {
			sb.append(sb.length() == 0 ? "" : ",").append(a.getName());
		}
		return sb.toString();
	}

	private static String line(Example example, List<Attribute> columns) {
		StringBuilder sb = new StringBuilder();
		for (Attribute a : columns) {
			sb.append(sb.length() == 0 ? "" : ",").append(example.getValueAsString(a));
		}
		return sb.toString();
	}
}
