---
title: (Kotlin) 8. 추상 클래스와 인터페이스
post_order: 8
thumbnail: https://velog.velcdn.com/images/jun34723/post/56051754-d4a2-48b1-b67a-28f5dc99367b/image.jpg
layout: post
author: jhj
categories:
  - StudyLog
  - Kotlin
tags:
  - Kotlin
  - AbstractClass
  - Interface
excerpt: abstract class와 interface의 특징
project_rank: "680"
sticker: emoji//1 f 4 aa
---

# abstract

- override 강요
- 선언 필수, 구현 선택
- `override`로 재정의
- 디폴트 정의 가능
    - 디폴트 정의 시 생략 가능
    - 하지만 그럴꺼면 왜씀

# 인터페이스

- 사전적 의미 : 두 장치를 연결하는 접속기
- 서로 **다른 객체**를 **연결**하는 통신 수단
- 객체간의 직접 연결을 막고, **중간 다리** 역할
- 동일한 구조에서 기능이 변경/추가/삭제 시 코드 수정을 방지
- 특징
    - 변경에 유연 : 객체 구현이 바뀌어도 코드에 영향 X
    - 낮은 결합도 : 객체의 구조를 몰라도 사용 가능
    - 다형성 구현 : 다양한 **input**/**type**에 따른 return
- 남용 시 가독성과 구현 효율이 떨어질 수 있음

![image.png](/assets/images/study_log/Kotlin/2025-09-18-AbstractClassAndInterface/image.png)

- `abstract` 선언 X, 기본 속성
- 다중 상속 가능
- 디폴트 정의가 존재하더라도 동일한 메소드가 다수 존재 시 override 필요

```kotlin
interface Clickable {
    val mouse: String
    abstract val keyboard: String

    fun click() = println("I was clicked") // 일반 메소드 선언
    fun showOff() = println("I'm clickable!") // 디폴트 구현이 있는 메소드
}

interface Focusable {
    fun setFocus(b: Boolean) =
        println("I ${if (b) "got" else "lost"} focus.")

    fun showOff()
}

class Button(override val mouse: String) : Clickable, Focusable {
    override val keyboard = "dice"

    override fun showOff() = println("?")
}

fun main() {
    val button = Button("daiso")   
    
    println(button.mouse)       // daiso
    println(button.keyboard)    // dice
    button.click()              // I was clicked
    button.showOff()            // ?
}
```

# 추상 클래스

- `abstract` 지정
- **인스턴스 불가**
- **상속**을 통해 구현
- 일반 method, properies **정의 가능**

```kotlin
abstract class Animal {	
	abstract fun makeSound()
	fun eat() = println("쩝쩝")
}
```

# 예제

```kotlin
abstract class StarCar {
    abstract val color: String
    abstract val tire: String
    abstract val displacement: Int
    abstract val handle: String

    object CarSpec {
        fun getTax(displacement: Int) =
            when {
                displacement > 2000 -> 2000
                else -> 1000
            }
    }

    open fun getSpec() {
        val tax = CarSpec.getTax(displacement)
        val spec = if(displacement>2000) "고사양" else "저사양"

        println("StarCar $spec 옵션 및 세금")
        println("----------------------------------------------------------")
        println(String.format("%-8s:%s", "색상", color))
        println(String.format("%-8s:%s", "타이어", tire))
        println(String.format("%-8s:%s", "배기량", displacement))
        println(String.format("%-8s:%s", "세금", tax))
    }
}

class StarCarLowGrade (
        override val color: String = "blue",
        override val tire: String = "일반타이어",
        override val displacement: Int = 2000,
        override val handle: String = "파워핸들",
    ) : StarCar() {
    }

class StarCarHighGrade (
    override val color: String = "red",
    override val tire: String = "슬릭타이어",
    override val displacement: Int = 2200,
    override val handle: String = "파워핸들",
    ) : StarCar()

fun main() {
    val lowGrade = StarCarLowGrade()
    val highGrade = StarCarHighGrade()

    lowGrade.getSpec()
    println()
    highGrade.getSpec()
}

>>>

StarCar 저사양 옵션 및 세금
----------------------------------------------------------
색상      :blue
타이어     :일반타이어
배기량     :2000
세금      :1000

StarCar 고사양 옵션 및 세금
----------------------------------------------------------
색상      :red
타이어     :슬릭타이어
배기량     :2200
세금      :1000
```

---

```kotlin
interface Engine {
    val engineName: String

    fun start() = println("$engineName 엔진 시동")
}

class GasEngine: Engine {
    override val engineName = "가솔린"
}

class ElectricEngine: Engine {
    override val engineName = "전기"
}

class Car(engine: Engine) {
    private val engine = engine

    fun start() {
        engine.start()
    }
}

fun main() {
    val myCar = Car(GasEngine())
    val yourCar = Car(ElectricEngine())

    myCar.start()       // 가솔린 엔진 시동
    yourCar.start()     // 전기 엔진 시동
}
```

---

```kotlin
interface Toy {
    val name: String

    fun showName() = println("$name 입니다.")
}

interface Missile: Toy {
    
    fun isMissile() = println("미사일 발사 가능합니다.")
}

interface ArmLeg: Toy {
    fun isArmLeg() = println("팔다리를 움직일 수 있습니다.")
}

interface Light: Toy {
    fun isLight() = println("불빛 발사 가능합니다.")
}

class Poollmpl: ArmLeg {
    override val name = "곰돌이"

    fun showFunctions() {
        showName()
        isArmLeg()
        println("=================================\n")
    }
}

class Mazingerlmpl: Missile, ArmLeg{
    override val name = "마징가"
    
    fun showFunctions() {
        showName()
        isMissile()
        isArmLeg()
        println("=================================\n")
    }
}

class Airplanelmpl: Missile, Light{
    override val name = "비행기"
    
    fun showFunctions() {
        showName()
        isMissile()
        isLight()
        println("=================================\n")
    }
}

fun main() {
    val airplane = Airplanelmpl()
    val poo = Poollmpl()
    val mazinga = Mazingerlmpl()
    
    airplane.showFunctions()
    poo.showFunctions()
    mazinga.showFunctions()
}

>>>

비행기 입니다.
미사일 발사 가능합니다.
불빛 발사 가능합니다.
=================================

곰돌이 입니다.
팔다리를 움직일 수 있습니다.
=================================

마징가 입니다.
미사일 발사 가능합니다.
팔다리를 움직일 수 있습니다.
=================================
```