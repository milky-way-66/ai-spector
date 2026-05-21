# Screen Detail:

> This document provides detailed layout, component, and interaction specifications for each screen. For the screen map and design system, see the Screen Map (List Screen) document. Use one section per screen; duplicate the structure below for each screen in the Screen Index.

**Source Requirements:** SRS Section 6.1 (User Interfaces)

---

## 1. Screen:

**Purpose:**

> Describe the purpose of this screen and what users can accomplish.

**User Role:** 

**Source Requirements:** SRS Section <X.X> - 

### 1.1 Visual Wireframe

> Use ASCII art or grid-based layout to show the visual structure. You can also reference an image file or Figma link.

**Option 1: ASCII Wireframe**

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]                    [User Menu] [Notifications]  │ ← Header (60px)
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│  Nav     │          Main Content Area                    │
│  Menu    │          ┌─────────────────┐                 │
│          │          │  Card/Component │                 │
│  Item 1  │          │                 │                 │
│  Item 2  │          └─────────────────┘                 │
│  Item 3  │          ┌─────────────────┐                 │
│          │          │  Card/Component │                 │
│          │          │                 │                 │
│          │          └─────────────────┘                 │
│          │                                               │
├──────────┴───────────────────────────────────────────────┤
│  Footer Content                                           │ ← Footer (40px)
└─────────────────────────────────────────────────────────┘
```

**Option 2: Grid Layout Description**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER (100% width, 60px height)                        │
│ [Logo: 200px] [Spacer] [User Menu: 150px] [Notif: 50px] │
├─────────────────────────────────────────────────────────┤
│ SIDEBAR │ MAIN CONTENT (flex: 1)                         │
│ (250px) │ ┌───────────────────────────────────────────┐ │
│         │ │ STATS CARDS (3 columns, equal width)        │ │
│ Nav     │ │ [Card 1] [Card 2] [Card 3]                │ │
│ Menu    │ └───────────────────────────────────────────┘ │
│         │ ┌───────────────────────────────────────────┐ │
│ Item 1  │ │ TABLE/LIST (full width)                    │ │
│ Item 2  │ │ [Row 1] [Row 2] [Row 3]                   │ │
│         │ └───────────────────────────────────────────┘ │
└─────────┴───────────────────────────────────────────────┘
```

**Option 3: Image Reference**

> **Wireframe Image:** `[screens/screen-name-wireframe.png]` or `[Figma Link]`
>
> **High-Fidelity Mockup:** `[screens/screen-name-mockup.png]` or `[Figma Link]`

### 1.2 Layout Structure


| Component        | Position        | Width/Height | Description |
| ---------------- | --------------- | ------------ | ----------- |
| **Header**       | Top             | 100% × 60px  |             |
| **Navigation**   | <Left/Side/Top> | 250px × auto |             |
| **Main Content** | Center          | flex: 1      |             |
| **Sidebar**      | <Right/Left>    | 300px × auto |             |
| **Footer**       | Bottom          | 100% × 40px  |             |


### 1.3 Component Details

**Header:**

- Logo: 
- User menu: 
- Notifications:

**Main Content Area:**


| Component          | Description | Visual Style |
| ------------------ | ----------- | ------------ |
| **Component Name** | Description | Style notes  |


**Key Components:**

**Component Name:**

- **Purpose:** What it does
- **Visual Representation:**
  ```
  ┌─────────────────────────────┐
  │ [Icon] Title Text            │
  │ ───────────────────────────  │
  │ Content area                 │
  │ [Button] [Button]            │
  └─────────────────────────────┘
  ```
- **Elements:**
  - <Element 1>:  (Position: <top/left/right>, Size: )
  - <Element 2>:  (Position: <top/left/right>, Size: )
- **Visual Style:**
  - Background: 
  - Border: <1px solid color>
  - Padding: <16px>
  - Margin: <8px>
  - Border radius: <4px>
- **Dimensions:** <Width × Height>
- **Interaction:**

### 1.4 User Interactions

**Primary Actions:**

- <Action 1>: 
- <Action 2>:

**Navigation Flow:**

- From this screen, users can navigate to:
  - <Screen/Page>: 
  - <Screen/Page>:

**Form Layout (if applicable):**

```
┌─────────────────────────────────────┐
│ Form Title                           │
│ ───────────────────────────────────  │
│ [Label]                              │
│ ┌─────────────────────────────────┐ │
│ │ Input Field                     │ │
│ └─────────────────────────────────┘ │
│ [Label]                              │
│ ┌─────────────────────────────────┐ │
│ │ Dropdown/Select                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ [Cancel] [Submit Button]             │
└─────────────────────────────────────┘
```

**Form Interactions:**

- :
- :

### 1.5 Field Validation and Default Data

> This section documents validation rules and default values for all input fields on this screen.
>
> **Note:** If this screen has no input fields or forms, this section can be omitted or marked as "N/A - No input fields on this screen."

**Field Validation and Default Data:**


| Field Name | Field Type                        | Required | Default Value              | Default Source                          | Validation Rules | Error Messages | Notes |
| ---------- | --------------------------------- | -------- | -------------------------- | --------------------------------------- | ---------------- | -------------- | ----- |
|            | <Text/Email/Number/Date/Dropdown> | <Yes/No> | <Default value or "Empty"> | <Auto-generated/System/User preference> |                  |                |       |


**Detailed Field Information:**

**:**

- **Type:** 
- **Required:** <Yes/No>
- **Default Value:** <Value or "Empty">
- **Default Source:** 
- **Min Length:**  characters
- **Max Length:**  characters
- **Pattern/Format:** 
- **Custom Validation:** 
- **Error Messages:**
  - Required: ""
  - Format: ""
  - Custom: ""
- **Real-time Validation:** <Yes/No - validates on blur/on change>
- **Dependencies:** 
- **Notes:**

 **(Dropdown):**

- **Type:** Dropdown/Select
- **Required:** <Yes/No>
- **Default Value:** 
- **Default Source:** <System/First option/User preference>
- **Options Source:** <Static list/Dynamic from API/User selection>
- **Options:**
  - : -
  - : -
- **Dependencies:** 
- **Validation Rules:** 
- **Error Messages:**

---

## 2. Screen:

**Purpose:**

> Describe the purpose of this screen.

**User Role:** 

**Source Requirements:** SRS Section <X.X>

### 2.1 Visual Wireframe

```
┌─────────────────────────────────────────────────────────┐
│ [Screen Layout - Use ASCII art or reference image]       │
└─────────────────────────────────────────────────────────┘
```

**Wireframe Image:** `[screens/screen-name-wireframe.png]` or `[Figma Link]`

### 2.2 Layout Structure


| Component | Position | Width/Height | Description |
| --------- | -------- | ------------ | ----------- |
|           |          |              |             |


### 2.3 Component Details

**:**

- **Purpose:** 
- **Visual Representation:**
  ```
  ┌─────────────────────────────┐
  │ Component Layout             │
  └─────────────────────────────┘
  ```
- **Elements:**
  - <Element 1>
  - <Element 2>
- **Visual Style:** 
- **Dimensions:** <Width × Height>
- **Interaction:**

### 2.4 User Interactions

**Primary Actions:**

- <Action 1>
- <Action 2>

---

## 3. Screen:

**Purpose:**

> Describe the purpose of this screen.

**User Role:** 

### 3.1 Visual Wireframe

### 3.2 Layout Structure

---

> Repeat the same section structure (Screen name → Wireframe → Layout → Component Details → User Interactions → Field Validation if applicable) for each additional screen in the Screen Index.

