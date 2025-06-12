---
title: (C++) 6. Conventions
post_order: 6
thumbnail: /assets/images/study_log/cpp/2025-06-10-Conventions/names.png
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming
  - Language
  - C++
  - conventions
excerpt: 변수, 함수 등 c++ 프로그래밍 이름 규칙
project_rank: "600"
sticker: emoji//1f4aa
---
# 공통
> 변수 또는 함수 등의 이름은 종류와 기능을 알리는 중요한 역할을 한다.
> 
>  일반적으로 **[Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html)** 가 대표적인 C++ style guide이나,
>  
> 모든 분야 및 단체에서 사용하는 것은 아니다. 다음에 나온 내용도 일반적인 규칙일 뿐, 프로젝트 종류 및 내용에 따라 달라질 수 있다.

## UpperCamelCase
> 대문자로 시작하고 단어를 구분하는 방법이다.

- 함수, class, struct 등

```cpp
AddTableEntry()
DeleteUrl()
OpenFileOrDie()

class UrlTable { ...
class UrlTableTester { ...  
struct UrlTableProperties { ...
```

## snake_case
> 소문자, 단어의 구분이나 띄어쓰기를 **"\_"** 로 구분

- 파일명. cpp
- 변수, namespace 등

```cpp
cpp_study.cpp
---
auto `a_local_variable`, `a_struct_data_member`, `a_class_data_member_`;
```

## 이름 규칙
> 함수 등의 기능을 파악하기 쉽게
> Verb + Noun + Type or Specialized name과 같이 **동사+목적어** 구조로 **~을 ~한다** 
> 와 같은 구조로 만든다. 다만 하나의 방법일 뿐 정해진 규칙은 아니다.

```cpp
bool fnInitDataSet(const DataSetType& DataSet); // initialize data set

class DataSetType {
public:
  bool initDataSet();
};
```

# Const, Consexpr
> **UpperCamelCase** 앞에 접두사로 **k**(constant를 의미)를 붙인다.

- `static` 또는 `global` 모두 k를 붙이며, 지역변수의 경우 선택사항
- 단 대문자로 구분이 어려운 경우 "\_"를 허용한다.

```cpp
const int kDaysInAWeek = 7; 
const int kAndroid8_0_0 = 24;	// Android (version) 8.0.0

void ComputeFoo(absl::string_view suffix) {
  // Either of these is acceptable.
  const absl::string_view kPrefix = "prefix";
  const absl::string_view prefix = "prefix";
  ...
}	// 지역변수의 경우 선택사항
```

# private, protected, bool
> private와 protected의 경우 **"\_"** 를 붙이는 것이 일반적
> 접두사 **m_** 을 사용하는 경우도 있음.
> bool의 경우 **b** 접두어와 **is**, **can**, **have** (**has**) 등의 조합을 사용하여 변수의 의미를 명확하게 표현.

```cpp
class Person {
public:
    // ... other public members ...

private:
    int _age; // 언더바 사용
    std::string m_name; // 접두사 m_ 사용
    bool bisEmpty; // is 접두사 사용
};
```

# Macro
>  **왠만하면 쓰지 않으며, const를 대신 사용한다**. 대문자를 사용하고 단어 사이에는 underscore를 사용한다.

```cpp
#define ROUND(x) ...
#define PI_ROUNDED 3.0
```

# 참고 : 헝가리안 표기법
> 변수의 타입을 표시하기 위해 접두사를 붙이는 표기법. 
> 데이터 타입을 바로 확인할 수 있다는 장점이 있으나
> 코드를 한번에 파악하기 어렵고 동적 할당의 경우 문제가 있는 등 최근에는 잘 사용하지 않는다.

- 일반

| 접두어       | 데이터 타입                                 |
| --------- | -------------------------------------- |
| `b`       | `byte`, `boolean`                      |
| `n`       | `int`, `short`                         |
| `i`       | `int`, `short` (주로 인덱스로 사용)            |
| `c`       | `int`, `short` (주로 크기로 사용)             |
| `l`       | `long`                                 |
| `f`       | `float`                                |
| `d`, `db` | `double`                               |
| `ld`      | `long double`                          |
| `w`       | `word`                                 |
| `dw`      | `double word`                          |
| `qw`      | `quad word`                            |
| `ch`      | `char`                                 |
| `sz`      | `NULL`로 끝나는 문자열                        |
| `str`     | C++ 문자열                                |
| `arr`     | 배열 (문자열 제외): 다른 접두어와 조합 가능             |
| `p`       | 포인터 (16비트, 32비트): 다른 접두어와 조합 가능        |
| `lp`      | 포인터 (32비트, 64비트): 다른 접두어와 조합 가능        |
| `psz`     | `NULL`로 끝나는 문자열을 가리키는 포인터 (16비트, 32비트) |
| `lpsz`    | `NULL`로 끝나는 문자열을 가리키는 포인터 (32비트, 64비트) |
| `fn`      | 함수 타입                                  |
| `pfn`     | 함수 포인터 (16비트, 32비트)                    |
| `lpfn`    | 함수 포인터 (64비트)                          |

- OOP

| 접두어  | 데이터 타입         |
| ---- | -------------- |
| `g_` | 네임스페이스의 글로벌 변수 |
| `m_` | 클래스의 멤버 변수     |
| `s_` | 클래스의 static 변수 |
| `c_` | 함수의 static 변수  |
