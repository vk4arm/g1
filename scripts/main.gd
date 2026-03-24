extends Control

@onready var bg = $Background/TextureRect
@onready var label = $UI/MarginContainer/RichTextLabel
@onready var audio_rap = $AudioRap
@onready var audio_classical = $AudioClassical

var current_step = 0
var paragraphs = [
	{
		"text": "[color=#ff5555]🧨 «Записки с обочины Империи»[/color]\n[color=#aaaaaa](из личного дневника Рида «Вектор» Коулза, командира банды «Техноклятва»)[/color]\n\n20 апреля 2026, сектор “Новая Атланта”, Зона D, бывший склад Amazon.\nБлокнот на обрывке синтетической бумаги, запах гари и психотоксинов.",
		"image": "res://assets/images/warehouse.png",
		"music": "rap"
	},
	{
		"text": "[color=#ff5555]Я родился в эпоху беспроводного бога.[/color]\nКогда президентами становились аватары, а армии – просто рои кода с винтами.\nТеперь я командую настоящими людьми. И — да — гусем. Но об этом позже.",
		"image": "res://assets/images/warehouse.png",
		"music": "rap"
	},
	{
		"text": "[color=#ffff55]🎯 День, когда упал Вашингтон[/color]\nНам сказали, что Россия применила тактический заряд на востоке. Ага.\nНо в тот же день доллар рухнул на 61%, связь легла, и в Белом доме загорелись камеры.\nМы сидели в фуд-корте у рейнджеров в Джорджии, когда CNN прекратил вещание.\nА вместо новостей пошли трансляции с боевых гусей.",
		"image": "res://assets/images/bunker.png",
		"music": "classical"
	},
	{
		"text": "[color=#55ff55]🦆 Про гусей[/color]\nДа-да, DARPA. Проект AGGRESSOR-AVIAN UNIT.\nИдея была в том, что гуси с ИИ лучше распознают цели, чем боты.\nРеальность — гуси научились отключать сервера дыханием, а в клювах у них — дозаторы с фентанилом, рицином и LSD.\nМы захватили одного. Звали его Ганс... Теперь он наш разведчик и исполнитель “мокрых” дел.\nПустили его в городскую мэрию — он клюнул мэра, тот увидел Бога и утонул в фонтане.",
		"image": "res://assets/images/goose.png",
		"music": "rap"
	},
	{
		"text": "[color=#55ffff]☣️ Про кибер и наркоту[/color]\nНаши хакеры — бывшие студенты MIT, которые теперь спят в серверах и не едят.\nМы написали вирус “ЗЕРКАЛО-7”: он заставляет человека видеть своё отражение, убивающее его.\nА наркотики? Мы перехватили конвой CDC.\nТак мы ликвидировали сенатора О’Брайена — подсадили ему в кофе микродозу “Корона-R3”.\nЧерез час он стал думать, что он дрон. Выпрыгнул с 12 этажа и кричал “Wi-Fi, активен!”",
		"image": "res://assets/images/hacker.png",
		"music": "classical"
	},
	{
		"text": "[color=#ff55ff]🛸 Про дронов[/color]\nУ нас нет F-35, но есть барахло с eBay и гений по имени Лекс.\nМы собрали рой из 312 FPV-дронов, дешевых, но умных. Назвали их “Филадельфийский хор”.\nКаждый из них оснащён одной иглой с “Сердцем-3” — синтетикой, вызывающей острую влюбленность и инфаркт через 12 минут.\nТак мы убрали губернатора Техаса. Он умер, обнимая свою тень на капоте броневика.",
		"image": "res://assets/images/drones.png",
		"music": "rap"
	},
	{
		"text": "[color=#aaaaaa]🧠 Про политиков[/color]\nОни бежали первыми. Но мы их догоняли.\nМы отправили биогуманоидов с печатными лицами к сенатору Риксу с ампулами фазового шока.\nТеперь Рикс сидит в подвале, дрожит, называет себя Мэри и боится света.",
		"image": "res://assets/images/bunker.png",
		"music": "classical"
	},
	{
		"text": "[color=#ffffff]🏴 Про банду[/color]\nНас 420 человек. 17 дронов. 1 гусь.\nКаждый боец прошёл обряд: кибер-игла в мозг, кодовая фраза — «Нет бога, кроме сбоев».\nМы — “Техноклятва”, клан кибер-мясников.\nВ каждом городе у нас спящие сервера.",
		"image": "res://assets/images/warehouse.png",
		"music": "rap"
	},
	{
		"text": "[color=#ff5555]⚠️ Про завтра[/color]\nЗавтра мы идём на Центр Временного Правительства в Небраске.\nНо у нас есть Ганс, свежая партия вируса «Песнь Воробья» и 200 дронов на биокеросине.\nИ если мы проиграем —\nпусть хотя бы история вспомнит,\nчто США были повержены не армией… а гусем с иглой и бандой, мечтающей о свободе.",
		"image": "res://assets/images/bunker.png",
		"music": "classical"
	}
]

func _ready():
	# Initially set up the first step
	update_scene()
	
func _input(event):
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		next_step()
	elif event is InputEventKey and event.pressed and event.keycode == KEY_SPACE:
		next_step()
		
func next_step():
	if current_step < paragraphs.size() - 1:
		current_step += 1
		update_scene()

func update_scene():
	var data = paragraphs[current_step]
	
	# Update text
	label.text = "[center]" + data["text"] + "[/center]"
	
	# Transition Image
	var tex = load(data["image"])
	if bg.texture != tex:
		# simple fade could go here, for now just swap
		bg.texture = tex
		
	# Update music
	if data["music"] == "rap":
		if not audio_rap.playing:
			audio_rap.play()
		# Fade classical out, rap in
		fade_music(audio_classical, audio_rap)
	elif data["music"] == "classical":
		if not audio_classical.playing:
			audio_classical.play()
		# Fade rap out, classical in
		fade_music(audio_rap, audio_classical)

func fade_music(from_player, to_player):
	# Create a simple tween for volume DB
	var tween = create_tween()
	tween.set_parallel(true)
	# Assuming normal volume is 0 dB, faded out is -80 dB
	tween.tween_property(from_player, "volume_db", -80.0, 1.0)
	tween.tween_property(to_player, "volume_db", 0.0, 1.0)
