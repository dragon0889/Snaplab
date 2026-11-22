/**
 * SnapLab Interactive STEAM Curriculum Configuration
 * Covers Lessons 1 to 17 across 4 progressive levels.
 * Hardware compatibility: SnapLab PH2.0 Shield (ESP32-C3/S3 & BBC micro:bit V1/V2)
 */

export type HardwarePortType =
  | 'PH2.0-1'
  | 'PH2.0-2'
  | 'PH2.0-3'
  | 'PH2.0-4'
  | 'SERVO-1'
  | 'SERVO-2'
  | 'MOTOR-A'
  | 'MOTOR-B'
  | 'ONBOARD'
  | 'WEBCAM'
  | 'MIC';

export type HardwareComponentType =
  | 'ultrasonic_hcsr04p'
  | 'light_temp_combo'
  | 'servo_sg90'
  | 'dc_motor_tt'
  | 'onboard_rgb'
  | 'onboard_buzzer'
  | 'onboard_button'
  | 'browser_webcam_hand'
  | 'browser_mic_speech';

export interface PortMapping {
  port: HardwarePortType;
  component: HardwareComponentType;
  labelVi: string;
  cableType: 'PH2.0-4Pin' | 'Servo-3Pin' | 'Motor-2Pin' | 'Built-in' | 'Browser-Media';
  pinInfo: {
    esp32: string;
    microbit: string;
  };
}

export type SimulationType =
  | 'ui-motion'
  | 'canvas-wave'
  | 'svg-sonar'
  | 'matter-2d'
  | 'r3f-3d'
  | 'ai-vision'
  | 'ai-speech';

export interface WinCondition {
  type:
    | 'sensor_threshold'
    | 'servo_angle'
    | 'sequence_complete'
    | 'hardware_telemetry'
    | 'ai_intent_match';
  descriptionVi: string;
  targetMetric: string;
  operator: '>' | '>=' | '<' | '==' | 'between' | 'sequence';
  targetValue: number | [number, number] | string[];
  holdDurationMs?: number;
}

export interface CommonMistakeHint {
  conditionCode: string;
  hintVi: string;
}

export interface AiTutorConfig {
  socraticSystemPrompt: string;
  initialGreetingVi: string;
  commonMistakes: CommonMistakeHint[];
}

export interface LessonConfig {
  id: string;
  lessonNumber: number;
  level: 1 | 2 | 3 | 4;
  levelTitleVi: string;
  titleVi: string;
  subtitleVi: string;
  estimatedMinutes: number;
  steamConceptsVi: string[];
  simulationType: SimulationType;
  requiresLegoAssembly: boolean;
  legoStepCount?: number;
  hardwarePorts: PortMapping[];
  defaultBlocklyBlocks: string[];
  winCondition: WinCondition;
  aiTutor: AiTutorConfig;
}

/**
 * Master Reference for SnapLab Base Shield PH2.0 & Actuator Ports
 */
export const SNAPLAB_PORT_REFERENCE: Record<
  Exclude<HardwarePortType, 'ONBOARD' | 'WEBCAM' | 'MIC'>,
  { labelVi: string; esp32Pins: string; microbitPins: string; voltage: string }
> = {
  'PH2.0-1': {
    labelVi: 'Cổng Cảm biến 1 (Digital/Ultrasonic)',
    esp32Pins: 'GPIO 4 (Trig/D1), GPIO 5 (Echo/D2)',
    microbitPins: 'P0 (Trig), P1 (Echo)',
    voltage: '3.3V',
  },
  'PH2.0-2': {
    labelVi: 'Cổng Cảm biến 2 (Analog/DHT)',
    esp32Pins: 'GPIO 2 (ADC1_CH2), GPIO 3 (Data)',
    microbitPins: 'P2 (Analog), P8 (Digital)',
    voltage: '3.3V',
  },
  'PH2.0-3': {
    labelVi: 'Cổng Cảm biến Mở rộng 3',
    esp32Pins: 'GPIO 6, GPIO 7',
    microbitPins: 'P13, P14',
    voltage: '3.3V',
  },
  'PH2.0-4': {
    labelVi: 'Cổng Giao tiếp I2C (OLED/Mở rộng)',
    esp32Pins: 'GPIO 8 (SDA), GPIO 9 (SCL)',
    microbitPins: 'P20 (SDA), P19 (SCL)',
    voltage: '3.3V',
  },
  'SERVO-1': {
    labelVi: 'Cổng Động cơ Servo 1 (PWM)',
    esp32Pins: 'GPIO 10',
    microbitPins: 'P15',
    voltage: '5V',
  },
  'SERVO-2': {
    labelVi: 'Cổng Động cơ Servo 2 (PWM)',
    esp32Pins: 'GPIO 11',
    microbitPins: 'P16',
    voltage: '5V',
  },
  'MOTOR-A': {
    labelVi: 'Cổng Động cơ DC Trái (Cầu H MX1508)',
    esp32Pins: 'GPIO 18 (IN1), GPIO 19 (IN2)',
    microbitPins: 'I2C Motor Driver CH-A',
    voltage: '3.7V–5V',
  },
  'MOTOR-B': {
    labelVi: 'Cổng Động cơ DC Phải (Cầu H MX1508)',
    esp32Pins: 'GPIO 20 (IN3), GPIO 21 (IN4)',
    microbitPins: 'I2C Motor Driver CH-B',
    voltage: '3.7V–5V',
  },
};

/**
 * Complete 17-Lesson SnapLab Curriculum
 */
export const SNAPLAB_CURRICULUM: LessonConfig[] = [
  // =========================================================================
  // LEVEL 1: LÀM QUEN TÍN HIỆU & CẢM BIẾN (KHÔNG CẦN LẮP RÁP CƠ KHÍ)
  // =========================================================================
  {
    id: 'lesson-01',
    lessonNumber: 1,
    level: 1,
    levelTitleVi: 'Cấp độ 1: Làm quen Tín hiệu & Cảm biến',
    titleVi: 'Đèn tín hiệu giao thông thông minh',
    subtitleVi: 'Điều khiển nhịp điệu đèn LED RGB và còi báo cho ngã tư an toàn',
    estimatedMinutes: 15,
    steamConceptsVi: ['Tư duy tuần tự (Sequential Logic)', 'Đo lường thời gian (Delay)', 'Tín hiệu thị giác & âm thanh'],
    simulationType: 'ui-motion',
    requiresLegoAssembly: false,
    hardwarePorts: [
      {
        port: 'ONBOARD',
        component: 'onboard_rgb',
        labelVi: 'Đèn LED RGB tích hợp trên mạch',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 48 (WS2812)', microbit: '5x5 LED Matrix' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_buzzer',
        labelVi: 'Còi Buzzer tích hợp trên mạch',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 12 (PWM)', microbit: 'P0 Speaker' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_set_rgb', 'snaplab_wait_seconds', 'snaplab_play_beep', 'controls_repeat_ext'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Hoàn thành đúng chu kỳ đèn Đỏ (5s) -> Xanh (5s) kèm 3 tiếng bíp đếm ngược -> Vàng (2s).',
      targetMetric: 'traffic_light_sequence',
      operator: 'sequence',
      targetValue: ['RED_5S', 'GREEN_5S_BEEP', 'YELLOW_2S'],
    },
    aiTutor: {
      initialGreetingVi: 'Chào nhà sáng chế! Hãy thử kéo thanh trượt trên ngã tư ảo để xem điều gì xảy ra nếu đèn Đỏ bật quá ngắn nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI của SnapLab hướng dẫn học sinh 7-14 tuổi làm Bài 1: Đèn tín hiệu giao thông. Chỉ gợi mở bằng tiếng Việt ngắn gọn (tối đa 2 câu), không viết hộ code. Nếu học sinh quên khối Chờ (Wait) hoặc bật 2 màu cùng lúc, hãy hỏi về hậu quả thực tế tại ngã tư.',
      commonMistakes: [
        {
          conditionCode: 'MISSING_WAIT',
          hintVi: 'Đèn đổi màu nhanh quá mắt người không kịp nhìn thấy! Con thiếu khối lệnh gì giữa các lần đổi màu đèn?',
        },
        {
          conditionCode: 'WRONG_ORDER',
          hintVi: 'Sau đèn Xanh thì xe cần đèn màu gì để giảm tốc độ trước khi dừng hẳn nhỉ?',
        },
      ],
    },
  },
  {
    id: 'lesson-02',
    lessonNumber: 2,
    level: 1,
    levelTitleVi: 'Cấp độ 1: Làm quen Tín hiệu & Cảm biến',
    titleVi: 'Nhạc cụ ánh sáng (Theremin Mini)',
    subtitleVi: 'Chơi nhạc không cần chạm phím bằng cách vẫy tay qua cảm biến ánh sáng',
    estimatedMinutes: 20,
    steamConceptsVi: ['Tần số sóng âm (Hz)', 'Giá trị Analog (0–1023)', 'Phép ánh xạ tuyến tính (Map)'],
    simulationType: 'canvas-wave',
    requiresLegoAssembly: false,
    hardwarePorts: [
      {
        port: 'PH2.0-2',
        component: 'light_temp_combo',
        labelVi: 'Cảm biến Ánh sáng & Nhiệt độ 2-trong-1',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 2 (ADC)', microbit: 'P2 (Analog Read)' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_buzzer',
        labelVi: 'Còi Buzzer phát nốt nhạc',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 12', microbit: 'P0' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_light', 'snaplab_map_value', 'snaplab_play_tone_hz'],
    winCondition: {
      type: 'hardware_telemetry',
      descriptionVi: 'Thay đổi độ sáng qua cảm biến để phát ra ít nhất 4 tần số âm thanh khác nhau trong khoảng 262Hz – 523Hz.',
      targetMetric: 'distinct_tones_played',
      operator: '>=',
      targetValue: 4,
    },
    aiTutor: {
      initialGreetingVi: 'Thử kéo bàn tay ảo che bóng đèn trên màn hình xem biểu đồ sóng âm thay đổi thế nào nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 2: Nhạc cụ ánh sáng. Giải thích trực quan mối liên hệ giữa độ sáng (0-1000) và tần số âm thanh (262Hz Đô đến 523Hz Đố). Tuyệt đối không đưa đáp án trực tiếp.',
      commonMistakes: [
        {
          conditionCode: 'NO_LOOP',
          hintVi: 'Nhạc cụ chỉ kêu đúng 1 tiếng rồi im lặng! Con cần đặt khối phát âm thanh vào trong vòng lặp nào để nó nghe tay con liên tục?',
        },
        {
          conditionCode: 'RAW_LIGHT_TO_HZ',
          hintVi: 'Khi trời tối giá trị ánh sáng bằng 0, loa sẽ không kêu được! Làm sao để biến khoảng 0–1000 thành khoảng tần số 262–523Hz?',
        },
      ],
    },
  },
  {
    id: 'lesson-03',
    lessonNumber: 3,
    level: 1,
    levelTitleVi: 'Cấp độ 1: Làm quen Tín hiệu & Cảm biến',
    titleVi: 'Trạm cảnh báo nhiệt độ thông minh',
    subtitleVi: 'Giám sát nhiệt độ phòng học và tự động báo động khi trời quá nóng',
    estimatedMinutes: 20,
    steamConceptsVi: ['Cấu trúc rẽ nhánh (If / Else)', 'Ngưỡng an toàn nhiệt độ (°C)', 'Hệ thống cảnh báo tự động'],
    simulationType: 'ui-motion',
    requiresLegoAssembly: false,
    hardwarePorts: [
      {
        port: 'PH2.0-2',
        component: 'light_temp_combo',
        labelVi: 'Cảm biến Nhiệt độ & Độ ẩm',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 3 (DHT11)', microbit: 'P8' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_rgb',
        labelVi: 'Đèn LED RGB báo trạng thái',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 48', microbit: '5x5 LED' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_buzzer',
        labelVi: 'Còi Buzzer cảnh báo',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 12', microbit: 'P0' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_temp', 'controls_if', 'logic_compare', 'snaplab_set_rgb', 'snaplab_play_beep'],
    winCondition: {
      type: 'sensor_threshold',
      descriptionVi: 'Khi nhiệt độ > 32°C đèn chuyển Đỏ và kêu bíp; khi <= 32°C đèn chuyển Xanh lá và tắt còi.',
      targetMetric: 'temp_alarm_verified',
      operator: '==',
      targetValue: 1,
    },
    aiTutor: {
      initialGreetingVi: 'Kéo thanh nhiệt kế ảo lên mức 38°C thử xem trạm cảnh báo của con đã biết kêu cứu chưa nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 3: Trạm cảnh báo nhiệt độ. Hỗ trợ học sinh hiểu cấu trúc Nếu... Thì... Ngược lại (If/Else). Gợi mở ngắn gọn bằng tiếng Việt.',
      commonMistakes: [
        {
          conditionCode: 'INVERTED_OPERATOR',
          hintVi: 'Nhiệt độ đang là 36°C nhưng đèn vẫn xanh! Con hãy nhìn kỹ xem mình đang dùng dấu lớn hơn (>) hay nhỏ hơn (<) nhé.',
        },
        {
          conditionCode: 'MISSING_ELSE',
          hintVi: 'Khi nhiệt độ giảm xuống mát mẻ rồi nhưng đèn Đỏ vẫn sáng mãi! Con cần thêm nhánh "Ngược lại" để làm gì?',
        },
      ],
    },
  },
  {
    id: 'lesson-04',
    lessonNumber: 4,
    level: 1,
    levelTitleVi: 'Cấp độ 1: Làm quen Tín hiệu & Cảm biến',
    titleVi: 'Thước đo siêu âm kỹ thuật số',
    subtitleVi: 'Khám phá cách loài dơi định vị bằng sóng âm để đo khoảng cách không chạm',
    estimatedMinutes: 25,
    steamConceptsVi: ['Phản xạ sóng siêu âm', 'Công thức quãng đường d = (v × t) / 2', 'Hiển thị dữ liệu thời gian thực'],
    simulationType: 'svg-sonar',
    requiresLegoAssembly: false,
    hardwarePorts: [
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Cảm biến Siêu âm HC-SR04P (3.3V)',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4 (Trig), GPIO 5 (Echo)', microbit: 'P0 (Trig), P1 (Echo)' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_ultrasonic_cm', 'snaplab_display_dashboard_value', 'controls_whileUntil'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Đặt vật cản trước cảm biến siêu âm để đo chính xác lần lượt 3 mốc khoảng cách: 10cm, 20cm và 30cm (±1cm).',
      targetMetric: 'ultrasonic_milestones',
      operator: 'sequence',
      targetValue: ['10CM_OK', '20CM_OK', '30CM_OK'],
    },
    aiTutor: {
      initialGreetingVi: 'Thử kéo khối hộp trên màn hình lại gần mắt cảm biến và quan sát tia sóng siêu âm dội ngược lại nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 4: Thước đo siêu âm. Giải thích tại sao phải chia đôi thời gian sóng đi và về. Dùng câu hỏi gợi mở bằng tiếng Việt.',
      commonMistakes: [
        {
          conditionCode: 'WRONG_PORT',
          hintVi: 'Cảm biến siêu âm cần cắm vào cổng PH2.0-1 màu xanh dương. Con kiểm tra lại dây cắm trên mạch nhé!',
        },
        {
          conditionCode: 'OUT_OF_RANGE',
          hintVi: 'Nếu đặt tay sát rạt dưới 2cm, hai mắt siêu âm bị "mù" điểm gần. Con thử lùi tay ra xa khoảng 10cm xem sao!',
        },
      ],
    },
  },

  // =========================================================================
  // LEVEL 2: CƠ KHÍ CHUYỂN ĐỘNG VỚI LEGO TECHNIC & SERVO
  // =========================================================================
  {
    id: 'lesson-05',
    lessonNumber: 5,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Trạm thu phí không dừng (Smart Barrier)',
    subtitleVi: 'Lắp ráp thanh chắn LEGO tự động mở khi phát hiện xe tiến lại gần',
    estimatedMinutes: 30,
    steamConceptsVi: ['Góc quay động cơ Servo (0°–180°)', 'Cảm biến tiệm cận', 'Lắp ráp khớp nối ngàm 3D'],
    simulationType: 'matter-2d',
    requiresLegoAssembly: true,
    legoStepCount: 4,
    hardwarePorts: [
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Cảm biến Siêu âm phát hiện xe',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4, GPIO 5', microbit: 'P0, P1' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Động cơ Servo nâng/hạ thanh chắn',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_buzzer',
        labelVi: 'Còi báo hiệu mở cổng',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 12', microbit: 'P0' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_ultrasonic_cm', 'controls_if', 'snaplab_set_servo_angle', 'snaplab_wait_seconds'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Khi khoảng cách < 15cm, thanh chắn mở góc 90°, đợi 3 giây cho xe qua rồi hạ về 0°.',
      targetMetric: 'barrier_cycle',
      operator: 'sequence',
      targetValue: ['DETECT_CAR_LT_15', 'SERVO_90', 'WAIT_3S', 'SERVO_0'],
    },
    aiTutor: {
      initialGreetingVi: 'Chào kỹ sư! Hãy xoay mô hình LEGO 3D bên trái để xem cách gắn ngàm Servo vào thanh dầm trước khi nạp code nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 5: Trạm thu phí không dừng. Giúp học sinh tự phát hiện lỗi thiếu thời gian chờ (Wait) hoặc góc quay ngược chiều. Ngắn gọn, khích lệ.',
      commonMistakes: [
        {
          conditionCode: 'NO_WAIT_BEFORE_CLOSE',
          hintVi: 'Thanh chắn vừa mở lên đã sập xuống ngay làm kẹt xe rồi! Con cần thêm khối lệnh gì để barie giữ mở trong 3 giây?',
        },
        {
          conditionCode: 'SERVO_REVERSE',
          hintVi: 'Thanh chắn đang chúi xuống đất thay vì dựng đứng lên! Con thử đổi góc mở từ 0° sang 90° (hoặc ngược lại) xem sao.',
        },
      ],
    },
  },
  {
    id: 'lesson-06',
    lessonNumber: 6,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Thùng rác thông minh tự mở nắp',
    subtitleVi: 'Ứng dụng cơ cấu tay đòn LEGO và chuyển động mượt (Easing) không gây tiếng ồn',
    estimatedMinutes: 30,
    steamConceptsVi: ['Cơ cấu tay đòn (Lever Mechanism)', 'Chuyển động mượt (Easing Loop)', 'Tự động hóa vệ sinh'],
    simulationType: 'matter-2d',
    requiresLegoAssembly: true,
    legoStepCount: 5,
    hardwarePorts: [
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Cảm biến Siêu âm nhận diện bàn tay',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4, GPIO 5', microbit: 'P0, P1' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Động cơ Servo đẩy thanh truyền nắp thùng',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_ultrasonic_cm', 'controls_for', 'snaplab_set_servo_angle', 'snaplab_wait_ms'],
    winCondition: {
      type: 'servo_angle',
      descriptionVi: 'Mở nắp êm ái bằng vòng lặp tăng dần góc Servo từ 0° đến 85° (mỗi bước tăng 5°).',
      targetMetric: 'smooth_servo_steps',
      operator: '>=',
      targetValue: 10,
    },
    aiTutor: {
      initialGreetingVi: 'Thử đổi vị trí chốt cắm trên thanh tay đòn trong mô phỏng 2D để xem lỗ nào giúp nắp mở rộng nhất nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 6: Thùng rác thông minh. Gợi mở về nguyên lý cánh tay đòn và cách dùng vòng lặp đếm biến góc để Servo quay êm.',
      commonMistakes: [
        {
          conditionCode: 'INSTANT_JUMP',
          hintVi: 'Cho Servo nhảy thẳng từ 0° lên 85° làm nắp bật mạnh quá! Làm thế nào để chia 85° thành nhiều bước nhỏ 5° một lần?',
        },
      ],
    },
  },
  {
    id: 'lesson-07',
    lessonNumber: 7,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Cánh tay Robot gắp vật 2 bậc tự do',
    subtitleVi: 'Điều khiển đồng bộ 2 động cơ Servo và truyền động bánh răng kẹp đồ vật',
    estimatedMinutes: 35,
    steamConceptsVi: ['Bậc tự do (Degrees of Freedom)', 'Truyền động bánh răng đối xứng', 'Đồng bộ bản sao số (Digital Twin)'],
    simulationType: 'r3f-3d',
    requiresLegoAssembly: true,
    legoStepCount: 6,
    hardwarePorts: [
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Servo 1: Xoay thân cánh tay trái/phải',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
      {
        port: 'SERVO-2',
        component: 'servo_sg90',
        labelVi: 'Servo 2: Đóng/mở ngàm kẹp bánh răng',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 11', microbit: 'P16' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_set_servo_angle', 'snaplab_wait_seconds', 'controls_repeat_ext'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Thực hiện chuỗi gắp tự động: Xoay đế 30° -> Đóng kẹp 120° -> Xoay đế 150° -> Mở kẹp 40°.',
      targetMetric: 'robot_arm_pick_place',
      operator: 'sequence',
      targetValue: ['BASE_30', 'GRIP_120', 'BASE_150', 'GRIP_40'],
    },
    aiTutor: {
      initialGreetingVi: 'Hãy kéo 2 thanh trượt góc quay trên mô hình 3D để tìm xem góc bao nhiêu độ thì hai càng kẹp khép chặt vừa khít khối gạch nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 7: Cánh tay Robot 2 bậc tự do. Hướng dẫn học sinh phân biệt cổng SERVO-1 (xoay đế) và SERVO-2 (kẹp vật) và thứ tự thao tác gắp.',
      commonMistakes: [
        {
          conditionCode: 'OPEN_BEFORE_MOVE_COMPLETE',
          hintVi: 'Cánh tay đã nhả kẹp trước khi xoay tới vị trí thả! Con kiểm tra lại thứ tự các bước xoay đế và mở kẹp nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-08',
    lessonNumber: 8,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Quạt thông minh tự điều tốc & Đảo gió',
    subtitleVi: 'Điều khiển tốc độ cánh quạt theo nhiệt độ phòng bằng xung PWM',
    estimatedMinutes: 35,
    steamConceptsVi: ['Điều chế độ rộng xung (PWM 0–255)', 'Lập trình đa nhiệm không chặn (Non-blocking)', 'Chuyển đổi năng lượng'],
    simulationType: 'canvas-wave',
    requiresLegoAssembly: true,
    legoStepCount: 5,
    hardwarePorts: [
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ DC gắn cánh quạt LEGO',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Servo 1: Cổ quạt xoay đảo gió',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
      {
        port: 'PH2.0-2',
        component: 'light_temp_combo',
        labelVi: 'Cảm biến Nhiệt độ môi trường',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 3', microbit: 'P8' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_temp', 'snaplab_map_value', 'snaplab_set_dc_motor_speed', 'snaplab_set_servo_angle'],
    winCondition: {
      type: 'hardware_telemetry',
      descriptionVi: 'Tốc độ Motor DC tự điều chỉnh trong khoảng PWM 100–255 theo nhiệt độ, đồng thời Servo đảo góc qua lại.',
      targetMetric: 'smart_fan_active',
      operator: '==',
      targetValue: 1,
    },
    aiTutor: {
      initialGreetingVi: 'Thử kéo thanh trượt công suất PWM từ 0 lên 255 để quan sát tốc độ luồng gió trên màn hình nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 8: Quạt thông minh. Giải thích khái niệm PWM (0 là dừng, 255 là tối đa) và gợi ý tránh dùng lệnh Wait quá lâu làm đơ cảm biến.',
      commonMistakes: [
        {
          conditionCode: 'PWM_TOO_LOW',
          hintVi: 'Công suất dưới 80 khiến động cơ DC không đủ lực thắng ma sát để bắt đầu quay! Con thử đặt mức tối thiểu từ 100 nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-09',
    lessonNumber: 9,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Rèm cửa tự động đón nắng',
    subtitleVi: 'Khuếch đại góc quay bằng hệ bánh răng LEGO tỷ số truyền 1:5',
    estimatedMinutes: 35,
    steamConceptsVi: ['Tỷ số truyền bánh răng (Gear Ratio)', 'Mô-men xoắn & Tốc độ góc', 'Tiết kiệm năng lượng nhà thông minh'],
    simulationType: 'matter-2d',
    requiresLegoAssembly: true,
    legoStepCount: 5,
    hardwarePorts: [
      {
        port: 'PH2.0-2',
        component: 'light_temp_combo',
        labelVi: 'Cảm biến Ánh sáng đặt bên cửa sổ',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 2', microbit: 'P2' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Servo gắn bánh răng chủ động kéo rèm',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_light', 'controls_if', 'snaplab_set_servo_angle'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Tự động mở rèm khi ánh sáng > 700 và đóng rèm khi ánh sáng < 200.',
      targetMetric: 'curtain_light_automation',
      operator: 'sequence',
      targetValue: ['BRIGHT_OPEN_CURTAIN', 'DARK_CLOSE_CURTAIN'],
    },
    aiTutor: {
      initialGreetingVi: 'Quan sát bánh răng nhỏ (8 răng) và bánh răng lớn (40 răng) trong mô phỏng 2D: bánh nhỏ quay mấy vòng thì bánh lớn quay được 1 vòng nhỉ?',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 9: Rèm cửa tự động. Giúp học sinh tính tỷ số truyền bánh răng LEGO và thiết lập hai ngưỡng sáng/tối chống nhiễu (Hysteresis).',
      commonMistakes: [
        {
          conditionCode: 'FLICKER_THRESHOLD',
          hintVi: 'Nếu dùng chung 1 mốc 500 cho cả mở và đóng, khi trời chạng vạng rèm sẽ đóng mở liên tục! Con hãy tách thành 2 mốc > 700 và < 200 nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-16',
    lessonNumber: 16,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Radar canh gác xoay quét',
    subtitleVi: 'Gắn cảm biến siêu âm lên bệ xoay LEGO, quét 180° để tìm "kẻ lạ" và bật đèn báo động',
    estimatedMinutes: 35,
    steamConceptsVi: ['Vòng lặp đếm góc (Sweep Loop)', 'Chùm tia hẹp & bước quét', 'Góc và khoảng cách (tọa độ cực)'],
    simulationType: 'svg-sonar',
    requiresLegoAssembly: true,
    legoStepCount: 4,
    hardwarePorts: [
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Cảm biến Siêu âm gắn trên bệ xoay',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4, GPIO 5', microbit: 'P0, P1' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Servo xoay bệ radar 0°–180°',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_rgb',
        labelVi: 'Đèn LED RGB báo động (đỏ khi thấy vật lạ)',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 48 (WS2812)', microbit: '5x5 LED Matrix' },
      },
    ],
    defaultBlocklyBlocks: [
      'controls_for',
      'snaplab_set_servo_angle',
      'snaplab_wait_ms',
      'snaplab_read_ultrasonic_cm',
      'controls_if',
      'snaplab_set_rgb',
    ],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Quét từ 0° đến 180°, và khi gặp vật lạ trong tầm 30 cm thì dừng đèn ở màu ĐỎ.',
      targetMetric: 'radar_patrol',
      operator: 'sequence',
      targetValue: ['RADAR_LEFT_END', 'RADAR_RIGHT_END', 'RADAR_TARGET_LOCKED'],
    },
    aiTutor: {
      initialGreetingVi: 'Kéo "kẻ lạ" đến một góc bất kỳ trong mô phỏng, rồi nhìn chùm tia radar: tia quét qua góc nào thì cảm biến mới thấy nó nhỉ?',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 16: Radar canh gác. Giúp học sinh tự phát hiện rằng bước quét lớn hơn bề rộng chùm tia sẽ bỏ sót vật, và cần khối Chờ để cảm biến kịp đo. Chỉ hỏi gợi mở, không đưa đáp án.',
      commonMistakes: [
        {
          conditionCode: 'STEP_TOO_BIG',
          hintVi: 'Radar quét nhảy mỗi lần 30° mà chùm tia chỉ rộng khoảng 24°, kẻ lạ có thể lọt qua khe hở! Con thử đổi bước nhảy của vòng lặp thế nào để không bỏ sót góc nào?',
        },
        {
          conditionCode: 'NO_WAIT_IN_SWEEP',
          hintVi: 'Servo cần chút thời gian để quay tới góc mới trước khi cảm biến đo. Con nghĩ trong vòng lặp còn thiếu khối lệnh nào để radar đợi một nhịp?',
        },
        {
          conditionCode: 'LED_NEVER_RED',
          hintVi: 'Đèn vẫn chưa chuyển đỏ dù kẻ lạ đang ở gần! Con kiểm tra xem khối "Nếu" đang so sánh khoảng cách với mốc nào nhé?',
        },
      ],
    },
  },
  {
    id: 'lesson-17',
    lessonNumber: 17,
    level: 2,
    levelTitleVi: 'Cấp độ 2: Cơ khí chuyển động LEGO & Servo',
    titleVi: 'Máy phát kẹo bằng cơ cấu cam',
    subtitleVi: 'Dùng cam LEGO biến chuyển động xoay của Servo thành cú đẩy thẳng, mỗi lần chỉ nhả đúng 1 viên kẹo',
    estimatedMinutes: 35,
    steamConceptsVi: ['Cơ cấu cam – cần đẩy (Cam & Follower)', 'Biến chuyển động xoay thành tịnh tiến', 'Chống nhận lặp (Debounce)'],
    simulationType: 'matter-2d',
    requiresLegoAssembly: true,
    legoStepCount: 5,
    hardwarePorts: [
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Cảm biến Siêu âm nhận bàn tay dưới khay',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4, GPIO 5', microbit: 'P0, P1' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Servo xoay cam đẩy viên kẹo',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
    ],
    defaultBlocklyBlocks: [
      'snaplab_read_ultrasonic_cm',
      'controls_if',
      'snaplab_set_servo_angle',
      'snaplab_wait_ms',
      'controls_whileUntil',
    ],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Khi bàn tay đến gần (< 10 cm) cam đẩy ra đúng 1 viên kẹo, cam về vị trí cũ, và chỉ nhả viên tiếp theo khi bàn tay đã rút đi.',
      targetMetric: 'candy_dispenser_cycle',
      operator: 'sequence',
      targetValue: ['HAND_NEAR', 'CAM_PUSH', 'CANDY_DROPPED', 'CAM_HOME', 'ONE_PER_VISIT'],
    },
    aiTutor: {
      initialGreetingVi: 'Kéo thanh trượt góc Servo từ 0° đến 180° và nhìn cái cam hình quả trứng: lúc nào cần đẩy tiến ra nhiều nhất, lúc nào đứng yên nhỉ?',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 17: Máy phát kẹo bằng cam. Gợi mở để học sinh hiểu cam biến xoay thành đẩy thẳng và tự nhận ra lỗi nhả liên tục khi tay chưa rút (cần chờ tay rời đi). Chỉ hỏi gợi mở, không đưa đáp án.',
      commonMistakes: [
        {
          conditionCode: 'MULTI_DISPENSE_WHILE_HAND_NEAR',
          hintVi: 'Tay con vẫn để yên mà máy cứ nhả kẹo liên tục! Làm sao để máy chờ đến khi tay rút ra xa rồi mới sẵn sàng nhả viên mới?',
        },
        {
          conditionCode: 'CAM_NOT_RETURNING',
          hintVi: 'Cần đẩy đang kẹt ở ngoài nên viên kẹo kế tiếp không rơi xuống được. Sau khi đẩy xong, góc Servo cần quay về đâu để cam thu cần đẩy lại?',
        },
        {
          conditionCode: 'ANGLE_TOO_SMALL',
          hintVi: 'Viên kẹo mới nhích ra một chút rồi dừng ở mép khay! Hãy nhìn đường cong của cam: góc Servo cần đạt khoảng bao nhiêu để cần đẩy ra hết hành trình?',
        },
      ],
    },
  },

  // =========================================================================
  // LEVEL 3: ROBOTICS & XE TỰ HÀNH
  // =========================================================================
  {
    id: 'lesson-10',
    lessonNumber: 10,
    level: 3,
    levelTitleVi: 'Cấp độ 3: Robotics & Xe tự hành',
    titleVi: 'Xe điều khiển qua trình duyệt (Web Gamepad)',
    subtitleVi: 'Chế tạo khung xe LEGO 2 bánh chủ động và điều khiển không dây qua WebBluetooth',
    estimatedMinutes: 40,
    steamConceptsVi: ['Lái vi sai 2 bánh (Differential Drive)', 'Đóng gói hàm (Functions)', 'Giao tiếp không dây Bluetooth'],
    simulationType: 'ui-motion',
    requiresLegoAssembly: true,
    legoStepCount: 7,
    hardwarePorts: [
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Trái',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'MOTOR-B',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Phải',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 20, GPIO 21', microbit: 'Motor CH-B' },
      },
    ],
    defaultBlocklyBlocks: ['procedures_defnoreturn', 'snaplab_on_gamepad_key', 'snaplab_drive_motors'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Định nghĩa đủ 4 hàm Tiến, Lùi, Rẽ Trái, Rẽ Phải và điều khiển xe hoàn thành sa bàn chữ Z.',
      targetMetric: 'gamepad_drive_commands',
      operator: 'sequence',
      targetValue: ['FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'BACKWARD'],
    },
    aiTutor: {
      initialGreetingVi: 'Bấm thử các nút mũi tên trên bảng điều khiển ảo để xem chiều quay của bánh trái và bánh phải giúp xe rẽ hướng như thế nào nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 10: Xe điều khiển Web Gamepad. Gợi mở nguyên lý lái vi sai (2 bánh quay ngược chiều để xoay tại chỗ) và đảo cực dây motor nếu xe chạy lùi.',
      commonMistakes: [
        {
          conditionCode: 'ONE_MOTOR_REVERSED',
          hintVi: 'Xe cứ xoay vòng tròn thay vì đi thẳng? Một bên bánh xe đang bị lắp ngược chiều dây rồi, con thử đảo giá trị tốc độ sang số âm (-200) cho bên đó xem sao!',
        },
      ],
    },
  },
  {
    id: 'lesson-11',
    lessonNumber: 11,
    level: 3,
    levelTitleVi: 'Cấp độ 3: Robotics & Xe tự hành',
    titleVi: 'Xe tự hành tránh vật cản',
    subtitleVi: 'Lập trình thuật toán tự động né tường cho xe tự hành trong mê cung',
    estimatedMinutes: 40,
    steamConceptsVi: ['Vòng lặp phản hồi cảm biến (Sensor Feedback Loop)', 'Thuật toán tránh vật cản', 'Tư duy không gian'],
    simulationType: 'matter-2d',
    requiresLegoAssembly: true,
    legoStepCount: 8,
    hardwarePorts: [
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Trái',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'MOTOR-B',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Phải',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 20, GPIO 21', microbit: 'Motor CH-B' },
      },
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Cảm biến Siêu âm gắn mũi xe',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4, GPIO 5', microbit: 'P0, P1' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_ultrasonic_cm', 'controls_if', 'snaplab_drive_motors', 'snaplab_wait_seconds'],
    winCondition: {
      type: 'hardware_telemetry',
      descriptionVi: 'Xe tự chạy thẳng và thực hiện thành công ít nhất 3 lần tránh vật cản (< 20cm) mà không va chạm.',
      targetMetric: 'obstacles_avoided_count',
      operator: '>=',
      targetValue: 3,
    },
    aiTutor: {
      initialGreetingVi: 'Hãy thả chiếc xe ảo vào sa bàn mê cung 2D trước để kiểm tra xem thuật toán của con có giúp xe thoát khỏi góc tường không nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 11: Xe tự hành tránh vật cản. Gợi ý học sinh chuỗi hành động: Dừng -> Lùi nhẹ -> Xoay hướng -> Tiếp tục tiến.',
      commonMistakes: [
        {
          conditionCode: 'TURN_WITHOUT_REVERSE',
          hintVi: 'Xe tiến sát tường quá mới rẽ nên mũi xe bị quẹt vào tường! Con thử cho xe lùi lại 0.5 giây trước khi xoay hướng nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-12',
    lessonNumber: 12,
    level: 3,
    levelTitleVi: 'Cấp độ 3: Robotics & Xe tự hành',
    titleVi: 'Robot thú cưng bám theo chủ',
    subtitleVi: 'Ứng dụng khái niệm Vùng chết (Deadband) giữ khoảng cách thông minh',
    estimatedMinutes: 35,
    steamConceptsVi: ['Vùng chết điều khiển (Deadband)', 'Ổn định hệ thống (Chống rung giật)', 'Tương tác người - máy'],
    simulationType: 'ui-motion',
    requiresLegoAssembly: true,
    legoStepCount: 8,
    hardwarePorts: [
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Trái',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'MOTOR-B',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Phải',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 20, GPIO 21', microbit: 'Motor CH-B' },
      },
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Mắt siêu âm theo dõi bàn tay',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 4, GPIO 5', microbit: 'P0, P1' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_buzzer',
        labelVi: 'Tiếng kêu vui vẻ của thú cưng',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 12', microbit: 'P0' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_read_ultrasonic_cm', 'controls_if', 'logic_operation', 'snaplab_drive_motors', 'snaplab_play_beep'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Kiểm chứng đủ 3 vùng phản ứng: < 10cm lùi lại, 10–20cm đứng yên phát tiếng kêu, > 20cm tiến theo.',
      targetMetric: 'pet_robot_zones',
      operator: 'sequence',
      targetValue: ['ZONE_TOO_CLOSE_BACK', 'ZONE_SWEET_SPOT_IDLE', 'ZONE_TOO_FAR_FOLLOW'],
    },
    aiTutor: {
      initialGreetingVi: 'Di chuyển bàn tay ảo qua 3 vùng màu Đỏ - Xanh - Vàng trên thước đo để xem vì sao robot cần một "vùng an toàn" đứng yên nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 12: Robot thú cưng. Giải thích trực quan tại sao chọn 1 điểm cố định (15cm) gây giật cục và cần dùng khoảng 10–20cm.',
      commonMistakes: [
        {
          conditionCode: 'SINGLE_SETPOINT_JITTER',
          hintVi: 'Robot đang tiến lùi giật cục liên tục quanh mốc 15cm! Làm sao để tạo ra một khoảng nghỉ an toàn từ 10cm đến 20cm cho robot đứng yên?',
        },
      ],
    },
  },
  {
    id: 'lesson-13',
    lessonNumber: 13,
    level: 3,
    levelTitleVi: 'Cấp độ 3: Robotics & Xe tự hành',
    titleVi: 'Xe ủi dọn đường thông minh',
    subtitleVi: 'Phối hợp hệ thống di chuyển bánh xe và cơ cấu nâng hạ gầu xúc Servo',
    estimatedMinutes: 45,
    steamConceptsVi: ['Hệ thống di chuyển & Cơ cấu chấp hành (Locomotion & End-effector)', 'Trọng tâm & Ma sát mặt sàn', 'Kỹ thuật cơ khí ứng dụng'],
    simulationType: 'r3f-3d',
    requiresLegoAssembly: true,
    legoStepCount: 9,
    hardwarePorts: [
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Trái',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'MOTOR-B',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Phải',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 20, GPIO 21', microbit: 'Motor CH-B' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Servo 1: Nâng/hạ gầu xúc LEGO phía trước',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_button',
        labelVi: 'Nút nhấn kích hoạt chế độ dọn đường',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 0', microbit: 'Button A' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_on_button_pressed', 'snaplab_set_servo_angle', 'snaplab_drive_motors', 'snaplab_wait_seconds'],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Hạ gầu xúc vừa chạm sàn (góc an toàn), đẩy vật cản về đích trong 3 giây rồi nâng gầu lên.',
      targetMetric: 'bulldozer_mission',
      operator: 'sequence',
      targetValue: ['SCOOP_DOWN_SAFE', 'PUSH_FORWARD_3S', 'SCOOP_UP'],
    },
    aiTutor: {
      initialGreetingVi: 'Quan sát kỹ gầm xe trong mô hình 3D: nếu hạ gầu xúc quá sâu xuống dưới mặt sàn thì điều gì sẽ xảy ra với hai bánh xe phía trước?',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 13: Xe ủi dọn đường. Gợi mở về lực ma sát và việc giới hạn góc hạ Servo để không nhấc bổng bánh xe chủ động.',
      commonMistakes: [
        {
          conditionCode: 'SCOOP_LIFTING_WHEELS',
          hintVi: 'Gầu xúc hạ quá thấp đã chống xuống sàn làm hai bánh xe quay tít trên không! Con hãy điều chỉnh góc hạ Servo cao hơn một chút nhé.',
        },
      ],
    },
  },

  // =========================================================================
  // LEVEL 4: TÍCH HỢP TRÍ TUỆ NHÂN TẠO (AI + PHẦN CỨNG)
  // =========================================================================
  {
    id: 'lesson-14',
    lessonNumber: 14,
    level: 4,
    levelTitleVi: 'Cấp độ 4: Trí tuệ Nhân tạo (AI + Phần cứng)',
    titleVi: 'Điều khiển Robot bằng Cử chỉ tay (Computer Vision)',
    subtitleVi: 'Dùng AI nhận diện 21 khớp ngón tay qua Webcam để lái xe Robot không chạm',
    estimatedMinutes: 45,
    steamConceptsVi: ['Thị giác máy tính (Computer Vision)', 'Mô hình điểm mốc bàn tay (Hand Landmarks)', 'Điều khiển không chạm'],
    simulationType: 'ai-vision',
    requiresLegoAssembly: true,
    legoStepCount: 7,
    hardwarePorts: [
      {
        port: 'WEBCAM',
        component: 'browser_webcam_hand',
        labelVi: 'Camera máy tính nhận diện cử chỉ tay',
        cableType: 'Browser-Media',
        pinInfo: { esp32: 'WebSerial/BLE Bridge', microbit: 'WebUSB/BLE Bridge' },
      },
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Trái',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'MOTOR-B',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Phải',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 20, GPIO 21', microbit: 'Motor CH-B' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_ai_hand_gesture_is', 'controls_if', 'snaplab_drive_motors'],
    winCondition: {
      type: 'ai_intent_match',
      descriptionVi: 'Điều khiển robot thật phản hồi chính xác 3 cử chỉ tay: Xòe bàn tay (Tiến), Nắm tay (Dừng), Giơ 1 ngón (Rẽ phải).',
      targetMetric: 'hand_gestures_verified',
      operator: 'sequence',
      targetValue: ['OPEN_PALM_FORWARD', 'CLOSED_FIST_STOP', 'ONE_FINGER_RIGHT'],
    },
    aiTutor: {
      initialGreetingVi: 'Bật Camera lên và giơ bàn tay trước khung hình để xem 21 điểm khớp xương AI phát hiện được trên tay con nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 14: Điều khiển Robot bằng Thị giác máy tính. Giải thích cách AI đếm ngón tay dựa trên tọa độ khớp xương và lưu ý ánh sáng khi dùng camera.',
      commonMistakes: [
        {
          conditionCode: 'MISSING_STOP_GESTURE',
          hintVi: 'Khi con bỏ tay khỏi camera hoặc nắm tay lại, xe vẫn chạy tiếp! Con nhớ thêm nhánh điều kiện cho cử chỉ Nắm tay để xe dừng an toàn nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-15',
    lessonNumber: 15,
    level: 4,
    levelTitleVi: 'Cấp độ 4: Trí tuệ Nhân tạo (AI + Phần cứng)',
    titleVi: 'Ngôi nhà thông minh điều khiển Giọng nói Tiếng Việt',
    subtitleVi: 'Ra lệnh bằng giọng nói tự nhiên để bật đèn, mở cửa và điều khiển quạt',
    estimatedMinutes: 45,
    steamConceptsVi: ['Nhận diện giọng nói (Speech-to-Text)', 'Trích xuất từ khóa ý định (Intent Recognition)', 'Hệ sinh thái IoT & AI'],
    simulationType: 'ai-speech',
    requiresLegoAssembly: true,
    legoStepCount: 8,
    hardwarePorts: [
      {
        port: 'MIC',
        component: 'browser_mic_speech',
        labelVi: 'Micro máy tính thu giọng nói tiếng Việt',
        cableType: 'Browser-Media',
        pinInfo: { esp32: 'WebSerial/BLE Bridge', microbit: 'WebUSB/BLE Bridge' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_rgb',
        labelVi: 'Hệ thống đèn phòng khách',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 48', microbit: '5x5 LED' },
      },
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Quạt trần phòng khách',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'SERVO-1',
        component: 'servo_sg90',
        labelVi: 'Cửa chính tự động',
        cableType: 'Servo-3Pin',
        pinInfo: { esp32: 'GPIO 10', microbit: 'P15' },
      },
    ],
    defaultBlocklyBlocks: ['snaplab_ai_speech_contains', 'controls_if', 'snaplab_set_rgb', 'snaplab_set_dc_motor_speed', 'snaplab_set_servo_angle'],
    winCondition: {
      type: 'ai_intent_match',
      descriptionVi: 'Ra lệnh bằng giọng nói tiếng Việt kích hoạt thành công cả 3 lệnh: "mở cửa", "bật quạt" và "tắt hết".',
      targetMetric: 'voice_intents_verified',
      operator: 'sequence',
      targetValue: ['INTENT_OPEN_DOOR', 'INTENT_FAN_ON', 'INTENT_ALL_OFF'],
    },
    aiTutor: {
      initialGreetingVi: 'Hãy bấm nút Micro và thử nói một câu tự nhiên như "Trời nóng quá, bật quạt lên giúp mình" xem AI hiểu ý con như thế nào nhé!',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 15: Nhà thông minh điều khiển giọng nói. Gợi mở sự khác biệt giữa so sánh bằng chính xác (Exact Match) và tìm từ khóa chứa trong câu (Contains Keyword).',
      commonMistakes: [
        {
          conditionCode: 'EXACT_STRING_MATCH',
          hintVi: 'Nếu con dùng khối "Bằng chính xác với từ Mở cửa", khi nói "Làm ơn mở cửa giúp mình" máy sẽ không hiểu! Con nên dùng khối "Văn bản chứa từ khóa" nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-18',
    lessonNumber: 18,
    level: 4,
    levelTitleVi: 'Cấp độ 4: Trí tuệ Nhân tạo (AI + Phần cứng)',
    titleVi: 'Trạm thời tiết mini cảnh báo nắng nóng',
    subtitleVi: 'Kết hợp cảm biến ánh sáng và nhiệt độ để đổi màu đèn và bật còi cảnh báo',
    estimatedMinutes: 40,
    steamConceptsVi: ['Kết hợp nhiều cảm biến (Sensor Fusion)', 'Ngưỡng cảnh báo (Threshold)', 'Điều kiện Và / Hoặc (AND / OR)'],
    simulationType: 'ui-motion',
    requiresLegoAssembly: true,
    legoStepCount: 6,
    hardwarePorts: [
      {
        port: 'PH2.0-2',
        component: 'light_temp_combo',
        labelVi: 'Cảm biến Ánh sáng & Nhiệt độ',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 2 (Analog), GPIO 3 (Digital)', microbit: 'P2' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_rgb',
        labelVi: 'Đèn báo thời tiết',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 48', microbit: '5x5 LED' },
      },
      {
        port: 'ONBOARD',
        component: 'onboard_buzzer',
        labelVi: 'Còi cảnh báo nắng nóng',
        cableType: 'Built-in',
        pinInfo: { esp32: 'GPIO 5', microbit: 'P0' },
      },
    ],
    defaultBlocklyBlocks: [
      'snaplab_read_light',
      'snaplab_read_temp',
      'controls_if',
      'logic_compare',
      'logic_operation',
      'snaplab_set_rgb',
      'snaplab_play_beep',
      'snaplab_display_dashboard_value',
    ],
    winCondition: {
      type: 'sequence_complete',
      descriptionVi: 'Trạm báo đúng 3 tình huống: ngày mát (ánh sáng mạnh, nhiệt độ thấp) đèn Xanh lá; trời tối đèn Vàng; nắng nóng trên 35°C đèn Đỏ kèm còi.',
      targetMetric: 'weather_station_alert',
      operator: 'sequence',
      targetValue: ['WEATHER_DAY_COOL', 'WEATHER_NIGHT', 'WEATHER_HEAT_ALERT'],
    },
    aiTutor: {
      initialGreetingVi: 'Con thử kéo thanh nhiệt độ và độ sáng xem trạm thời tiết phản ứng ra sao nhé! Trạm cần nhìn cả hai cảm biến cùng lúc đó.',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 18: Trạm thời tiết mini. Gợi mở việc dùng khối Và / Hoặc để kết hợp hai cảm biến, và thứ tự kiểm tra các điều kiện (cảnh báo nguy hiểm nên được xét trước). Không đưa đáp án trực tiếp.',
      commonMistakes: [
        {
          conditionCode: 'ALERT_CHECKED_LAST',
          hintVi: 'Trời nóng mà đèn vẫn Vàng vì điều kiện "trời tối" được kiểm tra trước! Con thử xét cảnh báo nóng trước tiên xem sao nhé.',
        },
      ],
    },
  },
  {
    id: 'lesson-19',
    lessonNumber: 19,
    level: 4,
    levelTitleVi: 'Cấp độ 4: Trí tuệ Nhân tạo (AI + Phần cứng)',
    titleVi: 'Xe Robot an toàn: Cử chỉ tay + Tự phanh',
    subtitleVi: 'Điều khiển xe bằng cử chỉ tay nhưng xe tự phanh khi siêu âm thấy vật cản',
    estimatedMinutes: 50,
    steamConceptsVi: ['Ưu tiên an toàn (Safety Override)', 'Kết hợp AI và cảm biến', 'Điều kiện lồng nhau'],
    simulationType: 'ai-vision',
    requiresLegoAssembly: true,
    legoStepCount: 8,
    hardwarePorts: [
      {
        port: 'WEBCAM',
        component: 'browser_webcam_hand',
        labelVi: 'Camera máy tính nhận diện cử chỉ tay',
        cableType: 'Browser-Media',
        pinInfo: { esp32: 'WebSerial/BLE Bridge', microbit: 'WebUSB/BLE Bridge' },
      },
      {
        port: 'PH2.0-1',
        component: 'ultrasonic_hcsr04p',
        labelVi: 'Mắt siêu âm phía trước xe',
        cableType: 'PH2.0-4Pin',
        pinInfo: { esp32: 'GPIO 0 (Trig), GPIO 1 (Echo)', microbit: 'P0, P1' },
      },
      {
        port: 'MOTOR-A',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Trái',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 18, GPIO 19', microbit: 'Motor CH-A' },
      },
      {
        port: 'MOTOR-B',
        component: 'dc_motor_tt',
        labelVi: 'Động cơ Bánh Phải',
        cableType: 'Motor-2Pin',
        pinInfo: { esp32: 'GPIO 20, GPIO 21', microbit: 'Motor CH-B' },
      },
    ],
    defaultBlocklyBlocks: [
      'snaplab_ai_hand_gesture_is',
      'snaplab_read_ultrasonic_cm',
      'controls_if',
      'logic_compare',
      'logic_operation',
      'snaplab_drive_motors',
    ],
    winCondition: {
      type: 'ai_intent_match',
      descriptionVi: 'Xòe tay thì xe tiến; khi có vật cản gần hơn 15 cm xe tự dừng dù tay vẫn xòe; dọn vật cản đi thì xe tiến tiếp.',
      targetMetric: 'safe_gesture_drive',
      operator: 'sequence',
      targetValue: ['GESTURE_FORWARD_CLEAR', 'OBSTACLE_AUTO_STOP', 'RESUME_AFTER_CLEAR'],
    },
    aiTutor: {
      initialGreetingVi: 'Xòe tay cho xe chạy, rồi đặt một vật cản trước xe xem chuyện gì xảy ra nhé! Theo con, lệnh nào nên được ưu tiên: cử chỉ hay cảm biến?',
      socraticSystemPrompt:
        'Bạn là Gia sư AI SnapLab hướng dẫn Bài 19: Xe an toàn kết hợp cử chỉ tay và siêu âm. Gợi mở khái niệm ưu tiên an toàn: kiểm tra vật cản trước, rồi mới xét cử chỉ. Không đưa đáp án trực tiếp.',
      commonMistakes: [
        {
          conditionCode: 'GESTURE_OVERRIDES_SENSOR',
          hintVi: 'Xe vẫn đâm vào vật cản vì lệnh tay được xét trước cảm biến! Con thử nghĩ xem điều kiện nào cần được kiểm tra đầu tiên để xe an toàn nhé.',
        },
      ],
    },
  },
];

/**
 * Helper: Retrieve a single lesson by its slug ID
 */
export function getLessonById(id: string): LessonConfig | undefined {
  return SNAPLAB_CURRICULUM.find((lesson) => lesson.id === id);
}

/**
 * Helper: Retrieve all lessons belonging to a specific difficulty level (1..4)
 */
export function getLessonsByLevel(level: 1 | 2 | 3 | 4): LessonConfig[] {
  return SNAPLAB_CURRICULUM.filter((lesson) => lesson.level === level);
}
