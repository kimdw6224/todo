import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const TodoApp());
}

class TodoApp extends StatelessWidget {
  const TodoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Todo List',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const TodoListPage(title: 'My Tasks'),
    );
  }
}

class TodoListPage extends StatefulWidget {
  const TodoListPage({super.key, required this.title});
  final String title;

  @override
  State<TodoListPage> createState() => _TodoListPageState();
}

class _TodoListPageState extends State<TodoListPage> {
  final List<String> _todos = <String>[];
  final TextEditingController _textController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadTodos();
  }

  // Load todos from local storage
  void _loadTodos() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _todos.addAll(prefs.getStringList('todos') ?? []);
    });
  }

  // Save todos to local storage
  void _saveTodos() async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setStringList('todos', _todos);
  }

  void _addTodo(String task) {
    if (task.isNotEmpty) {
      setState(() {
        _todos.add(task);
      });
      _saveTodos();
      _textController.clear();
    }
  }

  void _removeTodo(int index) {
    setState(() {
      _todos.removeAt(index);
    });
    _saveTodos();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    decoration: const InputDecoration(
                      hintText: 'Enter a task',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: _addTodo,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () => _addTodo(_textController.text),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _todos.length,
              itemBuilder: (context, index) {
                return ListTile(
                  title: Text(_todos[index]),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete, color: Colors.red),
                    onPressed: () => _removeTodo(index),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}