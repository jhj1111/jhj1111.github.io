---
title: 연산(arithmetic)과 연산자(operators)
thumbnail: https://acaroom.net/sites/default/files/uploads/datatypec.png
layout: post
author: jhj
categories:
  - StudyLog
  - Cpp
tags:
  - Programming Language
  - C++
excerpt: c++ 연산자의 종류와 우선순위
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# 산술연산(Arithmetic)

## 연산(arithmetic)과 연산자(operators)

- 연산(arithmetic) : 수나 식을 일정한 **규칙에 따라 계산** 하는것
- 연산자(operators)
    - 어떠한 행위를 하는 것으로 범위가 매우 넓고 다양
    - 대부분 오버로딩(overloading) 가능
    - 사용자 정의 자료형일 경우 연산자 정의 필요

| 연산자이름 | 문법 | 클래스 내부 정의 | 클래스 외부 정의 |
| --- | --- | --- | --- |
| unary plus | +a | T T::operator+() const; | T operator+(const T &a); |
| unary minus | -a | T T::operator-() const; | T operator-(const T &a); |
| addition | a + b | T T::operator+(const T2 &b) const; | T operator+(const T &a, const T2 &b); |
| subtraction | a - b | T T::operator-(const T2 &b) const; | T operator-(const T &a, const T2 &b); |
| multiplication | a * b | T T::operator*(const T2 &b) const; | T operator*(const T &a, const T2 &b); |
| division | a / b | T T::operator/(const T2 &b) const; | T operator/(const T &a, const T2 &b); |
| modulo | a % b | T T::operator%(const T2 &b) const; | T operator%(const T &a, const T2 &b); |
| bitwise NOT | ~a | T T::operator~() const; | T operator~(const T &a); |
| bitwise AND | a & b | T T::operator&(const T2 &b) const; | T operator&(const T &a, const T2 &b); |
| bitwise OR | a | b | T T::operator|(const T2 &b) const; | T operator|(const T &a, const T2 &b); |
| bitwise XOR | a ^ b | T T::operator^(const T2 &b) const; | T operator^(const T &a, const T2 &b); |
| bitwise left shift | a << b | T T::operator<<(const T2 &b) const; | T operator<<(const T &a, const T2 &b); |
| bitwise right shift | a >> b | T T::operator>>(const T2 &b) const; | T operator>>(const T &a, const T2 &b); |

## 연산자 우선순위
 
- [Microsoft C++ 공식문서](https://learn.microsoft.com/ko-kr/cpp/cpp/cpp-built-in-operators-precedence-and-associativity?view=msvc-170)

| 연산자 설명 | 연산자 | 대체 |
| --- | --- | --- |
| **그룹 1 우선 순위, 결합성 없음** |  |  |
| [범위 확인](https://learn.microsoft.com/ko-kr/cpp/cpp/scope-resolution-operator?view=msvc-170) | [`::`](https://learn.microsoft.com/ko-kr/cpp/cpp/scope-resolution-operator?view=msvc-170) |  |
| **그룹 2 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [멤버 선택(개체 또는 포인터)](https://learn.microsoft.com/ko-kr/cpp/cpp/member-access-operators-dot-and?view=msvc-170) | [`.` 또는 `->`](https://learn.microsoft.com/ko-kr/cpp/cpp/member-access-operators-dot-and?view=msvc-170) |  |
| [배열 아래 첨자](https://learn.microsoft.com/ko-kr/cpp/cpp/subscript-operator?view=msvc-170) | [`[]`](https://learn.microsoft.com/ko-kr/cpp/cpp/subscript-operator?view=msvc-170) |  |
| [함수 호출](https://learn.microsoft.com/ko-kr/cpp/cpp/function-call-operator-parens?view=msvc-170) | [`()`](https://learn.microsoft.com/ko-kr/cpp/cpp/function-call-operator-parens?view=msvc-170) |  |
| [후위 증가](https://learn.microsoft.com/ko-kr/cpp/cpp/postfix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) | [`++`](https://learn.microsoft.com/ko-kr/cpp/cpp/postfix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) |  |
| [후위 감소](https://learn.microsoft.com/ko-kr/cpp/cpp/postfix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) | [`--`](https://learn.microsoft.com/ko-kr/cpp/cpp/postfix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) |  |
| [형식 이름](https://learn.microsoft.com/ko-kr/cpp/cpp/typeid-operator?view=msvc-170) | [`typeid`](https://learn.microsoft.com/ko-kr/cpp/cpp/typeid-operator?view=msvc-170) |  |
| [상수 형식 변환](https://learn.microsoft.com/ko-kr/cpp/cpp/const-cast-operator?view=msvc-170) | [`const_cast`](https://learn.microsoft.com/ko-kr/cpp/cpp/const-cast-operator?view=msvc-170) |  |
| [동적 형식 변환](https://learn.microsoft.com/ko-kr/cpp/cpp/dynamic-cast-operator?view=msvc-170) | [`dynamic_cast`](https://learn.microsoft.com/ko-kr/cpp/cpp/dynamic-cast-operator?view=msvc-170) |  |
| [재해석된 형식 변환](https://learn.microsoft.com/ko-kr/cpp/cpp/reinterpret-cast-operator?view=msvc-170) | [`reinterpret_cast`](https://learn.microsoft.com/ko-kr/cpp/cpp/reinterpret-cast-operator?view=msvc-170) |  |
| [정적 형식 변환](https://learn.microsoft.com/ko-kr/cpp/cpp/static-cast-operator?view=msvc-170) | [`static_cast`](https://learn.microsoft.com/ko-kr/cpp/cpp/static-cast-operator?view=msvc-170) |  |
| **그룹 3 우선 순위, 오른쪽에서 왼쪽 연결** |  |  |
| [개체 또는 형식의 크기](https://learn.microsoft.com/ko-kr/cpp/cpp/sizeof-operator?view=msvc-170) | [`sizeof`](https://learn.microsoft.com/ko-kr/cpp/cpp/sizeof-operator?view=msvc-170) |  |
| [접두사 증가](https://learn.microsoft.com/ko-kr/cpp/cpp/prefix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) | [`++`](https://learn.microsoft.com/ko-kr/cpp/cpp/prefix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) |  |
| [접두사 감소](https://learn.microsoft.com/ko-kr/cpp/cpp/prefix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) | [`--`](https://learn.microsoft.com/ko-kr/cpp/cpp/prefix-increment-and-decrement-operators-increment-and-decrement?view=msvc-170) |  |
| [하나의 보수](https://learn.microsoft.com/ko-kr/cpp/cpp/one-s-complement-operator-tilde?view=msvc-170) | [`~`](https://learn.microsoft.com/ko-kr/cpp/cpp/one-s-complement-operator-tilde?view=msvc-170) | **`compl`** |
| [논리하지 않음](https://learn.microsoft.com/ko-kr/cpp/cpp/logical-negation-operator-exclpt?view=msvc-170) | [`!`](https://learn.microsoft.com/ko-kr/cpp/cpp/logical-negation-operator-exclpt?view=msvc-170) | **`not`** |
| [단항 부정](https://learn.microsoft.com/ko-kr/cpp/cpp/unary-plus-and-negation-operators-plus-and?view=msvc-170) | [`-`](https://learn.microsoft.com/ko-kr/cpp/cpp/unary-plus-and-negation-operators-plus-and?view=msvc-170) |  |
| [단항 더하기](https://learn.microsoft.com/ko-kr/cpp/cpp/unary-plus-and-negation-operators-plus-and?view=msvc-170) | [`+`](https://learn.microsoft.com/ko-kr/cpp/cpp/unary-plus-and-negation-operators-plus-and?view=msvc-170) |  |
| [주소-of](https://learn.microsoft.com/ko-kr/cpp/cpp/address-of-operator-amp?view=msvc-170) | [`&`](https://learn.microsoft.com/ko-kr/cpp/cpp/address-of-operator-amp?view=msvc-170) |  |
| [간접 참조](https://learn.microsoft.com/ko-kr/cpp/cpp/indirection-operator-star?view=msvc-170) | [`*`](https://learn.microsoft.com/ko-kr/cpp/cpp/indirection-operator-star?view=msvc-170) |  |
| [개체 만들기](https://learn.microsoft.com/ko-kr/cpp/cpp/new-operator-cpp?view=msvc-170) | [`new`](https://learn.microsoft.com/ko-kr/cpp/cpp/new-operator-cpp?view=msvc-170) |  |
| [개체 삭제](https://learn.microsoft.com/ko-kr/cpp/cpp/delete-operator-cpp?view=msvc-170) | [`delete`](https://learn.microsoft.com/ko-kr/cpp/cpp/delete-operator-cpp?view=msvc-170) |  |
| [캐스트](https://learn.microsoft.com/ko-kr/cpp/cpp/cast-operator-parens?view=msvc-170) | [`()`](https://learn.microsoft.com/ko-kr/cpp/cpp/cast-operator-parens?view=msvc-170) |  |
| **그룹 4 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [멤버에 대한 포인터(개체 또는 포인터)](https://learn.microsoft.com/ko-kr/cpp/cpp/pointer-to-member-operators-dot-star-and-star?view=msvc-170) | [`.*` 또는 `->*`](https://learn.microsoft.com/ko-kr/cpp/cpp/pointer-to-member-operators-dot-star-and-star?view=msvc-170) |  |
| **그룹 5 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [곱하기](https://learn.microsoft.com/ko-kr/cpp/cpp/multiplicative-operators-and-the-modulus-operator?view=msvc-170) | [`*`](https://learn.microsoft.com/ko-kr/cpp/cpp/multiplicative-operators-and-the-modulus-operator?view=msvc-170) |  |
| [나누기](https://learn.microsoft.com/ko-kr/cpp/cpp/multiplicative-operators-and-the-modulus-operator?view=msvc-170) | [`/`](https://learn.microsoft.com/ko-kr/cpp/cpp/multiplicative-operators-and-the-modulus-operator?view=msvc-170) |  |
| [계수](https://learn.microsoft.com/ko-kr/cpp/cpp/multiplicative-operators-and-the-modulus-operator?view=msvc-170) | [`%`](https://learn.microsoft.com/ko-kr/cpp/cpp/multiplicative-operators-and-the-modulus-operator?view=msvc-170) |  |
| **그룹 6 우선 순위(왼쪽에서 오른쪽 결합성)** |  |  |
| [더하기](https://learn.microsoft.com/ko-kr/cpp/cpp/additive-operators-plus-and?view=msvc-170) | [`+`](https://learn.microsoft.com/ko-kr/cpp/cpp/additive-operators-plus-and?view=msvc-170) |  |
| [빼기](https://learn.microsoft.com/ko-kr/cpp/cpp/additive-operators-plus-and?view=msvc-170) | [`-`](https://learn.microsoft.com/ko-kr/cpp/cpp/additive-operators-plus-and?view=msvc-170) |  |
| **그룹 7 우선 순위( 왼쪽에서 오른쪽 결합성)** |  |  |
| [왼쪽 시프트](https://learn.microsoft.com/ko-kr/cpp/cpp/left-shift-and-right-shift-operators-input-and-output?view=msvc-170) | [`<<`](https://learn.microsoft.com/ko-kr/cpp/cpp/left-shift-and-right-shift-operators-input-and-output?view=msvc-170) |  |
| [오른쪽 시프트](https://learn.microsoft.com/ko-kr/cpp/cpp/left-shift-and-right-shift-operators-input-and-output?view=msvc-170) | [`>>`](https://learn.microsoft.com/ko-kr/cpp/cpp/left-shift-and-right-shift-operators-input-and-output?view=msvc-170) |  |
| **그룹 8 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [보다 작음](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) | [`<`](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) |  |
| [보다 큼](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) | [`>`](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) |  |
| [작거나 같음](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) | [`<=`](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) |  |
| [크거나 같음](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) | [`>=`](https://learn.microsoft.com/ko-kr/cpp/cpp/relational-operators-equal-and-equal?view=msvc-170) |  |
| **그룹 9 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [등호](https://learn.microsoft.com/ko-kr/cpp/cpp/equality-operators-equal-equal-and-exclpt-equal?view=msvc-170) | [`==`](https://learn.microsoft.com/ko-kr/cpp/cpp/equality-operators-equal-equal-and-exclpt-equal?view=msvc-170) |  |
| [같지 않음](https://learn.microsoft.com/ko-kr/cpp/cpp/equality-operators-equal-equal-and-exclpt-equal?view=msvc-170) | [`!=`](https://learn.microsoft.com/ko-kr/cpp/cpp/equality-operators-equal-equal-and-exclpt-equal?view=msvc-170) | **`not_eq`** |
| **그룹 10 우선 순위 왼쪽에서 오른쪽 결합성** |  |  |
| [비트 AND](https://learn.microsoft.com/ko-kr/cpp/cpp/bitwise-and-operator-amp?view=msvc-170) | [`&`](https://learn.microsoft.com/ko-kr/cpp/cpp/bitwise-and-operator-amp?view=msvc-170) | **`bitand`** |
| **그룹 11 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [비트 배타적 OR](https://learn.microsoft.com/ko-kr/cpp/cpp/bitwise-exclusive-or-operator-hat?view=msvc-170) | [`^`](https://learn.microsoft.com/ko-kr/cpp/cpp/bitwise-exclusive-or-operator-hat?view=msvc-170) | **`xor`** |
| **그룹 12 우선 순위(왼쪽에서 오른쪽 결합성)** |  |  |
| [비트 포함 OR](https://learn.microsoft.com/ko-kr/cpp/cpp/bitwise-inclusive-or-operator-pipe?view=msvc-170) | [`|`](https://learn.microsoft.com/ko-kr/cpp/cpp/bitwise-inclusive-or-operator-pipe?view=msvc-170) | **`bitor`** |
| **그룹 13 우선 순위(왼쪽에서 오른쪽 결합성)** |  |  |
| [논리적 AND](https://learn.microsoft.com/ko-kr/cpp/cpp/logical-and-operator-amp-amp?view=msvc-170) | [`&&`](https://learn.microsoft.com/ko-kr/cpp/cpp/logical-and-operator-amp-amp?view=msvc-170) | **`and`** |
| **그룹 14 우선 순위(왼쪽에서 오른쪽 연결성)** |  |  |
| [논리적 OR](https://learn.microsoft.com/ko-kr/cpp/cpp/logical-or-operator-pipe-pipe?view=msvc-170) | [`||`](https://learn.microsoft.com/ko-kr/cpp/cpp/logical-or-operator-pipe-pipe?view=msvc-170) | **`or`** |
| **그룹 15 우선 순위, 오른쪽에서 왼쪽 결합성** |  |  |
| [조건부](https://learn.microsoft.com/ko-kr/cpp/cpp/conditional-operator-q?view=msvc-170) | [`? :`](https://learn.microsoft.com/ko-kr/cpp/cpp/conditional-operator-q?view=msvc-170) |  |
| [양도](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [곱하기 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`*=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [나누기 배정](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`/=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [모듈러스 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`%=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [추가 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`+=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [빼기 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`-=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [왼쪽 시프트 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`<<=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [오른쪽 시프트 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`>>=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) |  |
| [비트 AND 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`&=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | **`and_eq`** |
| [비트 포함 OR 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`|=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | **`or_eq`** |
| [비트 배타적 OR 할당](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | [`^=`](https://learn.microsoft.com/ko-kr/cpp/cpp/assignment-operators?view=msvc-170) | **`xor_eq`** |
| [throw 식](https://learn.microsoft.com/ko-kr/cpp/cpp/try-throw-and-catch-statements-cpp?view=msvc-170) | [`throw`](https://learn.microsoft.com/ko-kr/cpp/cpp/try-throw-and-catch-statements-cpp?view=msvc-170) |  |
| **그룹 16 우선 순위(왼쪽에서 오른쪽 결합성)** |  |  |
| [Comma](https://learn.microsoft.com/ko-kr/cpp/cpp/comma-operator?view=msvc-170) | [,](https://learn.microsoft.com/ko-kr/cpp/cpp/comma-operator?view=msvc-170) |  |